<script setup>
import { computed, onUnmounted, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import { request, refresh, state, time } from "../api.js";

const form = ref({ itemId: "", quantity: 30, reason: "" });
const busy = ref(false);
const error = ref("");
const message = ref("");
const submitComplete = ref(false);
let feedbackTimer;
onUnmounted(() => clearTimeout(feedbackTimer));
function showFeedback(text) {
  message.value = text;
  clearTimeout(feedbackTimer);
  feedbackTimer = setTimeout(() => { message.value = ""; submitComplete.value = false; }, 3200);
}
const showHistory = ref(false);
const historyLimit = ref(6);
const canEdit = computed(() => state.user?.role !== "VIEWER");
const active = computed(() =>
  state.dashboard.replenishments.filter(
    (row) => row.status === "PENDING" || row.status === "APPROVED",
  ),
);
const history = computed(() =>
  state.dashboard.replenishments.filter(
    (row) => row.status === "RECEIVED" || row.status === "REJECTED",
  ),
);
const selectedItem = computed(() =>
  state.dashboard.items.find((item) => String(item.id) === form.value.itemId),
);
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
    const resultMessage = (
      await request("/api/replenishments", {
        method: "POST",
        body: JSON.stringify({
          ...form.value,
          itemId: Number(form.value.itemId),
        }),
      })
    ).message;
    submitComplete.value = true;
    showFeedback(resultMessage);
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
    const resultMessage = (
      await request(`/api/replenishments/${id}/receive`, { method: "POST" })
    ).message;
    showFeedback(resultMessage);
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
      <p>从缺口发现到收货入库，每一步都有明确负责人。</p>
    </div>
    <RouterLink to="/advisor" class="subtle-link">从 AI 草案开始 →</RouterLink>
  </div>
  <div class="process-line flow-rail">
    <span><b>01</b> 发现缺口</span><span><b>02</b> 提交申请</span>
    <span><b>03</b> 主管审批</span><span><b>04</b> 收货入库</span>
  </div>
  <p v-if="error" class="alert error" role="alert">{{ error }}</p>
  <Transition name="notice-toast"><div v-if="message" class="flow-feedback-toast" role="status"><span>✓</span>{{ message }}</div></Transition>
  <div class="two-column flow-layout">
    <section v-if="canEdit" class="panel flow-form-panel">
      <div class="panel-head">
        <div>
          <span class="overline">01 / CREATE REQUEST</span>
          <h2>发起补货</h2>
        </div>
      </div>
      <p class="operation-subtitle">人工申请与 AI 草案会进入同一套审批流程。</p>
      <form class="field-grid" @submit.prevent="submit">
        <label class="wide"
          >物资
          <select v-model="form.itemId" required>
            <option value="" disabled>选择物资</option>
            <option
              v-for="item in state.dashboard.items"
              :key="item.id"
              :value="String(item.id)"
            >
              {{ item.name }} · 现存 {{ item.quantity }} / 阈值
              {{ item.minQuantity }}
            </option>
          </select>
        </label>
        <label
          >申请数量
          <input
            v-model.number="form.quantity"
            type="number"
            min="1"
            max="1000000"
            required
          />
        </label>
        <div class="stock-preview">
          <span>当前结存</span
          ><strong
            >{{ selectedItem?.quantity ?? "—" }}
            {{ selectedItem?.unit || "" }}</strong
          >
          <small>安全阈值 {{ selectedItem?.minQuantity ?? "—" }}</small>
        </div>
        <label class="wide"
          >申请原因
          <input
            v-model="form.reason"
            maxlength="200"
            required
            placeholder="说明库存缺口与实验用途"
          />
        </label>
        <p class="operation-rule wide">
          提交后等待主管审批；审批通过后仍需仓管员确认收货，才会更新库存。
        </p>
        <button class="primary-button scan-action" :class="{ 'action-complete': submitComplete }" :disabled="busy || submitComplete">
          {{ busy ? "提交中…" : submitComplete ? "已提交申请" : "提交申请" }} <span>{{ submitComplete ? "✓" : "→" }}</span>
        </button>
      </form>
    </section>
    <section class="panel flow-active-panel" :class="{ 'full-span': !canEdit }">
      <div class="panel-head">
        <div>
          <span class="overline">02 / IN PROGRESS</span>
          <h2>进行中的补货</h2>
        </div>
        <span class="pill">{{ active.length }} 单</span>
      </div>
      <div v-if="active.length" class="request-list active-requests">
        <article
          v-for="row in active"
          :key="row.id"
          class="request-card active-request"
        >
          <div class="request-top">
            <span
              class="pill"
              :class="row.status === 'APPROVED' ? 'good' : 'warn'"
              >{{ labels[row.status] }}</span
            >
            <time>{{ time(row.createdAt) }}</time>
          </div>
          <h3>
            {{ row.itemName }} <span>× {{ row.quantity }} {{ row.unit }}</span>
          </h3>
          <p>{{ row.reason }}</p>
          <small>申请人 {{ row.requester }}</small>
          <div
            class="request-progress"
            :class="{ approved: row.status === 'APPROVED' }"
          >
            <span>已申请</span><span>已审批</span><span>已收货</span>
          </div>
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
      <div v-else class="flow-empty">
        <span aria-hidden="true">◇</span>
        <strong>当前没有进行中的补货单</strong>
        <p>发现低库存时，可由人工发起或从 AI 草案确认提交。</p>
      </div>
    </section>
  </div>
  <section class="panel flow-history">
    <button
      type="button"
      class="history-toggle"
      :aria-expanded="showHistory"
      @click="showHistory = !showHistory"
    >
      <span
        ><span class="overline">ARCHIVE</span><strong>已完成与已拒绝</strong>
        <small
          >最近记录 {{ history.length }} 单 · 默认收起，便于专注当前工作</small
        ></span
      >
      <b>{{ showHistory ? "收起 ↑" : "展开记录 ↓" }}</b>
    </button>
    <div v-if="showHistory" class="history-body">
      <div
        v-for="row in history.slice(0, historyLimit)"
        :key="row.id"
        class="history-row"
      >
        <span class="history-state" :class="row.status.toLowerCase()">{{
          labels[row.status]
        }}</span>
        <strong>{{ row.itemName }}</strong>
        <span>{{ row.quantity }} {{ row.unit }}</span>
        <small>{{ row.requester }} · {{ time(row.createdAt) }}</small>
      </div>
      <p v-if="!history.length" class="empty">暂无归档记录</p>
      <button
        v-if="history.length > historyLimit"
        type="button"
        class="record-more"
        @click="historyLimit += 6"
      >
        再显示 {{ Math.min(6, history.length - historyLimit) }} 单 ↓
      </button>
    </div>
  </section>
</template>
