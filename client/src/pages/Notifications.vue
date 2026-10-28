<script setup>
import { useRouter } from "vue-router";
import { request, refresh, state, time } from "../api.js";
const router = useRouter();
async function open(row) {
  if (!row.isRead) {
    await request(`/api/notifications/${row.id}/read`, { method: "POST" });
    await refresh();
  }
  router.push(row.targetPath);
}
</script>
<template>
  <div class="page-heading">
    <div>
      <span class="overline">INBOX</span>
      <h1>消息中心</h1>
      <p>审批、收货和库存预警集中处理。</p>
    </div>
    <span class="pill">{{ state.unread }} 未读</span>
  </div>
  <section class="panel notice-list">
    <button
      v-for="row in state.notifications"
      :key="row.id"
      type="button"
      class="notice-row"
      :class="{ unread: !row.isRead }"
      @click="open(row)"
    >
      <span class="notice-symbol">{{ row.isRead ? "○" : "●" }}</span
      ><span class="notice-content"
        ><strong>{{ row.title }}</strong
        ><small>{{ row.body }}</small></span
      ><time>{{ time(row.createdAt) }}</time
      ><span>→</span>
    </button>
    <p v-if="!state.notifications.length" class="empty">暂无消息</p>
  </section>
</template>
