import { reactive } from "vue";

export const state = reactive({
  user: null,
  dashboard: { items: [], movements: [], approvals: [], replenishments: [] },
  analytics: { itemTrends: {}, zones: [], skuCount: 0, lowCount: 0 },
  notifications: [],
  unread: 0,
  aiConfigured: false,
  latestPlan: null,
  loading: false,
  error: "",
});

export async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(path, {
      credentials: "same-origin",
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    });
  } catch {
    throw new Error("无法连接服务，请确认后端已启动后重试");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(data.error || `请求失败 (${response.status})`);
  return data;
}

export async function refreshNotifications() {
  const data = await request("/api/notifications");
  state.notifications = data.notifications;
  state.unread = Number(data.unread) || 0;
  return data;
}

export async function loadUser() {
  try {
    state.user = (await request("/api/auth/me")).user;
  } catch {
    state.user = null;
  }
  return state.user;
}

export async function refresh() {
  state.loading = true;
  state.error = "";
  try {
    const [dashboard, analytics, notifications, health, latest] = await Promise.all([
      request("/api/dashboard"),
      request("/api/analytics"),
      request("/api/notifications"),
      request("/api/health"),
      request("/api/ai/plans/latest"),
    ]);
    state.dashboard = dashboard;
    state.analytics = analytics;
    state.notifications = notifications.notifications;
    state.unread = notifications.unread;
    state.aiConfigured = health.aiConfigured;
    state.latestPlan = latest.run;
  } catch (error) {
    state.error = error.message;
  } finally {
    state.loading = false;
  }
}

export function time(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
