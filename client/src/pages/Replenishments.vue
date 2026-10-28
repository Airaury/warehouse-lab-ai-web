<script setup>
import { computed, ref, watch } from "vue";
import { request, refresh, state, time } from "../api.js";
const form = ref({ itemId: "", quantity: 30, reason: "" });
const busy = ref(false),
  error = ref(""),
  message = ref("");
const canEdit = computed(() => state.user?.role !== "VIEWER");
watch(
  () => state.dashboard.items,
  (items) => {
    if (!form.value.itemId && items.length)
      form.value.itemId = String(items[0].id);
  },
  { immediate: true },
);
async function submit() {
  busy.value = true;
  error.value = "";
  message.value = "";
  try {
    message.value = (
      await request("/api/replenishments", {
        method: "POST",
        body: JSON.stringify({
          ...form.value,
          itemId: Number(form.value.itemId),
        }),
      })
    ).message;
    form.value.reason = "";
    await refresh();
  } catch (err) {
    error.value = err.message;
  } finally {
    busy.value = false;
  }
}
async function receive(id) {
  busy.value = true;
  error.value = "";
  message.value = "";
  try {
    message.value = (
      await request(`/api/replenishments/${id}/receive`, { method: "POST" })
    ).message;
    await refresh();
  } catch (err) {
    error.value = err.message;
  } finally {
    busy.value = false;
  }
}
const labels = {
  PENDING: "待审批",
  APPROVED: "待收货",
  REJECTED: "已拒绝",
  RECEIVED: "已入库",
};
</script>
<template>
  <div class="page-heading">
    <div>
      <span class="overline">REPLENISHMENT FLOW</span>
      <h1>补货流程</h1>
      <p>申请、审批、收货，全程留痕。</p>
    </div>
  </div>
  <div class="process-line">
    <span>01 发现缺口</span><span>02 发起申请</span><span>03 主管审批</span
    ><span>04 收货入库</span>
  </div>
  <p v-if="error" class="alert error" role="alert">{{ error }}</p>
  <p v-if="message" class="alert success" role="status">{{ message }}</p>
  <div class="two-column">
    <section v-if="canEdit" class="panel">
      <div class="panel-head">
        <div>
          <span class="overline">NEW REQUEST</span>
          <h2>发起补货</h2>
        </div>
      </div>
      <form class="field-grid" @submit.prevent="submit">
        <label class="wide"
          >物资<select v-model="form.itemId" required>
            <option value="" disabled>选择物资</option>
            <option
              v-for="item in state.dashboard.items"
              :key="item.id"
              :value="String(item.id)"
            >
              {{ item.name }} · 现存 {{ item.quantity }} / 阈值
              {{ item.minQuantity }}
            </option>
          </select></label
        ><label
          >申请数量<input
            v-model.number="form.quantity"
            type="number"
            min="1"
            max="1000000"
            required /></label
        ><label class="wide"
          >申请原因<input
            v-model="form.reason"
            maxlength="200"
            required
            placeholder="说明库存缺口与用途" /></label
        ><button class="primary-button" :disabled="busy">
          提交申请 <span>→</span>
        </button>
      </form>
    </section>
    <section class="panel" :class="{ 'full-span': !canEdit }">
      <div class="panel-head">
        <div>
          <span class="overline">REQUESTS</span>
          <h2>补货单</h2>
        </div>
        <span class="pill">{{ state.dashboard.replenishments.length }}</span>
      </div>
      <div v-if="state.dashboard.replenishments.length" class="request-list">
        <article
          v-for="row in state.dashboard.replenishments"
          :key="row.id"
          class="request-card"
        >
          <div class="request-top">
            <span
              class="pill"
              :class="row.status === 'REJECTED' ? 'warn' : 'good'"
              >{{ labels[row.status] }}</span
            ><time>{{ time(row.createdAt) }}</time>
          </div>
          <h3>
            {{ row.itemName }} <span>× {{ row.quantity }} {{ row.unit }}</span>
          </h3>
          <p>{{ row.reason }}</p>
          <small>{{ row.requester }}</small>
          <div
            v-if="row.status === 'APPROVED' && canEdit"
            class="request-actions"
          >
            <button
              class="approve"
              type="button"
              :disabled="busy"
              @click="receive(row.id)"
            >
              确认收货入库
            </button>
          </div>
        </article>
      </div>
      <p v-else class="empty">暂无补货申请</p>
    </section>
  </div>
</template>
