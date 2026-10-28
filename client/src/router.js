import { createRouter, createWebHistory } from "vue-router";
import { loadUser, state } from "./api.js";
import Login from "./pages/Login.vue";
import Overview from "./pages/Overview.vue";
import Inventory from "./pages/Inventory.vue";
import Operations from "./pages/Operations.vue";
import Approvals from "./pages/Approvals.vue";
import Replenishments from "./pages/Replenishments.vue";
import Analytics from "./pages/Analytics.vue";
import Advisor from "./pages/Advisor.vue";
import Notifications from "./pages/Notifications.vue";
import Users from "./pages/Users.vue";

export const router = createRouter({
  history: createWebHistory(),
  scrollBehavior() {
    return { top: 0 };
  },
  routes: [
    { path: "/login", component: Login, meta: { title: "登录" } },
    { path: "/", component: Overview, meta: { title: "运营总览" } },
    { path: "/inventory", component: Inventory, meta: { title: "实时库存" } },
    { path: "/operations", component: Operations, meta: { title: "出入库" } },
    { path: "/approvals", component: Approvals, meta: { title: "审批中心" } },
    {
      path: "/replenishments",
      component: Replenishments,
      meta: { title: "补货流程" },
    },
    { path: "/analytics", component: Analytics, meta: { title: "数据分析" } },
    { path: "/advisor", component: Advisor, meta: { title: "AI 决策台" } },
    {
      path: "/notifications",
      component: Notifications,
      meta: { title: "消息中心" },
    },
    { path: "/users", component: Users, meta: { title: "账号管理" } },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
});

router.beforeEach(async (to) => {
  if (!state.user) await loadUser();
  if (to.path !== "/login" && !state.user)
    return { path: "/login", query: { redirect: to.fullPath } };
  if (to.path === "/login" && state.user) return "/";
  if (
    ["/approvals", "/users"].includes(to.path) &&
    state.user?.role !== "MANAGER"
  )
    return "/";
  if (
    ["/operations", "/replenishments"].includes(to.path) &&
    state.user?.role === "VIEWER"
  )
    return "/";
  document.title = `${to.meta.title} · 仓序 LAB`;
});
