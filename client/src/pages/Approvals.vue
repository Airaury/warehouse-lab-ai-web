<script setup>
import { computed, ref } from "vue";
import { request, refresh, state, time } from "../api.js";
const busy = ref(false),
  error = ref(""),
  message = ref("");
const replenishments = computed(() =>
  state.dashboard.replenishments.filter((row) => row.status === "PENDING"),
);
async function review(path, decision) {
  busy.value = true;
  error.value = "";
  message.value = "";
  try {
    message.value = (
      await request(path, {
        method: "POST",
        body: JSON.stringify({ decision }),
      })
    ).message;
    await refresh();
  } catch (err) {
    error.value = err.message;
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <div class="page-heading">
    <div>
      <span class="overline">APPROVAL DESK</span>
      <h1>审批中心</h1>
      <p>确认大额出库与补货申请。</p>
    </div>
  </div>
  <p v-if="error" class="alert error" role="alert">{{ error }}</p>
  <p v-if="message" class="alert success" role="status">{{ message }}</p>
  <div class="two-column">
    <section class="panel">
      <div class="panel-head">
        <div>
          <span class="overline">OUTBOUND</span>
          <h2>出库待审</h2>
        </div>
        <span class="pill">{{ state.dashboard.approvals.length }}</span>
      </div>
      <div v-if="state.dashboard.approvals.length" class="request-list">
        <article
          v-for="row in state.dashboard.approvals"
          :key="row.id"
          class="request-card"
        >
          <div class="request-top">
            <span class="pill warn">出库申请</span
            ><time>{{ time(row.createdAt) }}</time>
          </div>
          <h3>{{ row.itemName }}</h3>
          <p>{{ row.quantity }} {{ row.unit }} · {{ row.note || "无备注" }}</p>
          <div class="request-actions">
            <button
              type="button"
              :disabled="busy"
              @click="review(`/api/approvals/${row.id}`, 'REJECTED')"
            >
              拒绝</button
            ><button
              type="button"
              class="approve"
              :disabled="busy"
              @click="review(`/api/approvals/${row.id}`, 'APPROVED')"
            >
              批准出库
            </button>
          </div>
        </article>
      </div>
      <p v-else class="empty">暂无出库审批</p>
    </section>
    <section class="panel">
      <div class="panel-head">
        <div>
          <span class="overline">REPLENISHMENT</span>
          <h2>补货待审</h2>
        </div>
        <span class="pill">{{ replenishments.length }}</span>
      </div>
      <div v-if="replenishments.length" class="request-list">
        <article
          v-for="row in replenishments"
          :key="row.id"
          class="request-card"
        >
          <div class="request-top">
            <span class="pill good">补货申请</span
            ><time>{{ time(row.createdAt) }}</time>
          </div>
          <h3>{{ row.itemName }}</h3>
          <p>{{ row.quantity }} {{ row.unit }} · {{ row.reason }}</p>
          <small>申请人 {{ row.requester }}</small>
          <div class="request-actions">
            <button
              type="button"
              :disabled="busy"
              @click="
                review(`/api/replenishments/${row.id}/review`, 'REJECTED')
              "
            >
              拒绝</button
            ><button
              type="button"
              class="approve"
              :disabled="busy"
              @click="
                review(`/api/replenishments/${row.id}/review`, 'APPROVED')
              "
            >
              批准补货
            </button>
          </div>
        </article>
      </div>
      <p v-else class="empty">暂无补货审批</p>
    </section>
  </div>
</template>
