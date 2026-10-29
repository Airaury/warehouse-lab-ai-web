<script setup>
import { computed, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import { request, refreshNotifications, state, time } from "../api.js";
import RollingNumber from "../components/RollingNumber.vue";

const router = useRouter();
const categories = [
  { key: "all", label: "全部" },
  { key: "approval", label: "审批" },
  { key: "replenishment", label: "补货" },
  { key: "inventory", label: "库存预警" },
  { key: "operation", label: "出入库" },
  { key: "system", label: "其他" },
];
const category = ref("all");
const expanded = ref("");
const showRead = ref(false);
const busy = ref(false);
const processingId = ref(null);
const complete = ref(false);
const error = ref("");
const toast = ref("");
const summary = ref("");
const summaryBusy = ref(false);
const summaryError = ref("");
let toastTimer;
let completeTimer;

function classify(path = "", title = "") {
  if (path.startsWith("/approvals")) return "approval";
  if (/补货|收货/.test(title)) return "replenishment";
  if (path.startsWith("/replenishments")) return "replenishment";
  if (path.startsWith("/inventory")) return "inventory";
  if (path.startsWith("/operations")) return "operation";
  return "system";
}
const visibleRows = computed(() => state.notifications.filter((row) =>
  (showRead.value || !row.isRead) && (category.value === "all" || classify(row.targetPath, row.title) === category.value),
));
const groups = computed(() => categories.slice(1).map((entry) => ({
  ...entry,
  rows: visibleRows.value.filter((row) => classify(row.targetPath, row.title) === entry.key),
})).filter((entry) => entry.rows.length));
function countFor(key) {
  return state.notifications.filter((row) => (showRead.value || !row.isRead) && (key === "all" || classify(row.targetPath, row.title) === key)).length;
}
function showToast(text) {
  clearTimeout(toastTimer);
  toast.value = text;
  toastTimer = setTimeout(() => (toast.value = ""), 3000);
}
function setCategory(key) {
  category.value = key;
  expanded.value = key === "all" ? "" : key;
  summary.value = "";
  summaryError.value = "";
}
async function open(row) {
  if (processingId.value) return;
  processingId.value = row.id;
  error.value = "";
  try {
    if (!row.isRead) {
      await request(`/api/notifications/${row.id}/read`, { method: "POST" });
      row.isRead = 1;
      state.unread = Math.max(0, Number(state.unread) - 1);
      await refreshNotifications().catch(() => {});
    }
    await router.push(row.targetPath);
  } catch (err) {
    error.value = err.message;
  } finally {
    processingId.value = null;
  }
}
async function markAll() {
  if (busy.value || !Number(state.unread)) return;
  busy.value = true;
  error.value = "";
  try {
    const result = await request("/api/notifications/read-all", { method: "POST" });
    state.notifications = state.notifications.map((row) => ({ ...row, isRead: 1 }));
    state.unread = 0;
    showRead.value = false;
    complete.value = true;
    showToast(`已完成：${result.count} 条消息标为已读`);
    await refreshNotifications().catch(() => {});
    clearTimeout(completeTimer);
    completeTimer = setTimeout(() => (complete.value = false), 3000);
  } catch (err) {
    error.value = err.message;
  } finally {
    busy.value = false;
  }
}
async function analyze() {
  if (summaryBusy.value) return;
  summaryBusy.value = true;
  summary.value = "";
  summaryError.value = "";
  try {
    const result = await request("/api/ai/notifications-summary", {
      method: "POST", body: JSON.stringify({ category: category.value }),
    });
    summary.value = result.summary;
  } catch (err) {
    summaryError.value = err.message;
  } finally {
    summaryBusy.value = false;
  }
}
onUnmounted(() => { clearTimeout(toastTimer); clearTimeout(completeTimer); });
</script>

<template>
  <div class="page-heading">
    <div><span class="overline">INBOX / TRIAGE</span><h1>消息中心</h1><p>按业务类型整理消息，先处理影响库存与流程的事项。</p></div>
    <div class="notice-heading-actions">
      <span class="pill"><RollingNumber :value="Number(state.unread)" /> 未读</span>
      <button type="button" class="notice-view-toggle" :aria-pressed="showRead" @click="showRead = !showRead">{{ showRead ? "只看未读" : "查看已读" }}</button>
      <button type="button" class="secondary-button notice-complete-button" :class="{ complete }" :disabled="busy || !Number(state.unread)" @click="markAll">{{ busy ? "处理中…" : complete ? "完成 ✓" : "全部标为已读" }}</button>
    </div>
  </div>
  <p v-if="error" class="alert error" role="alert">{{ error }}</p>
  <Transition name="notice-toast"><p v-if="toast" class="alert success notice-toast" role="status">{{ toast }}</p></Transition>
  <div class="notice-tabs" role="group" aria-label="消息分类">
    <button v-for="entry in categories" :key="entry.key" type="button" :class="{ active: category === entry.key }" :aria-pressed="category === entry.key" @click="setCategory(entry.key)">{{ entry.label }} <span>{{ countFor(entry.key) }}</span></button>
  </div>
  <section class="notice-ai-panel" aria-label="AI 消息分析">
    <div><span class="overline">AI MESSAGE BRIEF</span><h2>让仓灵整理当前消息</h2><p>按所选分类生成优先级、待办和下一步建议；通知中的库存为历史快照。</p></div>
    <button type="button" class="primary-button scan-action" :disabled="summaryBusy || !state.aiConfigured || !countFor(category)" @click="analyze">{{ summaryBusy ? "正在分析…" : "AI 分析消息" }} <span>↗</span></button>
    <p v-if="summaryError" class="notice-summary-error" role="alert">{{ summaryError }}</p>
    <div v-if="summary" class="notice-summary" role="status"><strong>仓灵简报</strong><p>{{ summary }}</p></div>
  </section>
  <TransitionGroup name="notice" tag="div" class="notice-groups">
    <section v-for="group in groups" :key="group.key" class="notice-category-card" :class="{ expanded: expanded === group.key }">
      <button type="button" class="notice-category-head" :aria-expanded="expanded === group.key" @click="expanded = expanded === group.key ? '' : group.key">
        <span class="notice-category-icon">{{ group.key === "approval" ? "✓" : group.key === "replenishment" ? "◇" : group.key === "inventory" ? "!" : group.key === "operation" ? "⇄" : "◉" }}</span>
        <span><strong>{{ group.label }}</strong><small>{{ group.rows[0]?.title }} · {{ time(group.rows[0]?.createdAt) }}</small></span>
        <b>{{ group.rows.length }}</b><i>{{ expanded === group.key ? "收起 ↑" : "展开 ↓" }}</i>
      </button>
      <Transition name="stack-expand"><div v-if="expanded === group.key" class="notice-category-body">
        <TransitionGroup name="notice" tag="div" class="notice-stack">
          <button v-for="row in group.rows" :key="row.id" type="button" class="notice-row" :class="{ unread: !row.isRead }" :disabled="processingId === row.id" @click="open(row)">
            <span class="notice-symbol">{{ row.isRead ? "○" : "●" }}</span><span class="notice-content"><strong>{{ row.title }}</strong><small>{{ row.body }}</small></span><time>{{ time(row.createdAt) }}</time><span>→</span>
          </button>
        </TransitionGroup>
      </div></Transition>
    </section>
  </TransitionGroup>
  <p v-if="!groups.length" class="panel empty notice-empty">{{ showRead ? "当前分类暂无消息记录" : "未读消息已处理完，可切换查看已读记录" }}</p>
</template>
