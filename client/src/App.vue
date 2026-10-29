<script setup>
import { computed, ref, watch } from "vue";
import { RouterLink, RouterView, useRoute, useRouter } from "vue-router";
import { request, refresh, state } from "./api.js";
import AiCompanion from "./components/AiCompanion.vue";

const route = useRoute();
const router = useRouter();
const theme = ref(localStorage.getItem("warehouse-theme") === "dark" ? "dark" : "light");
watch(theme, (value) => {
  document.documentElement.dataset.theme = value;
  localStorage.setItem("warehouse-theme", value);
}, { immediate: true });
const title = computed(() => route.meta.title || "运营总览");
const manager = computed(() => state.user?.role === "MANAGER");
const approver = computed(() =>
  ["MANAGER", "DEPUTY"].includes(state.user?.role),
);
const operator = computed(() => state.user?.role !== "VIEWER");
const vReveal = {
  mounted(el) {
    if (!("IntersectionObserver" in window)) return;
    const targets = [...el.querySelectorAll(".page-heading, .overview-hero, .metric-card, .panel, .zone-visualization")];
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.dataset.revealVisible = "";
          observer.unobserve(entry.target);
        }
      }
    }, { threshold: 0.08, rootMargin: "0px 0px -24px 0px" });
    targets.forEach((target, index) => {
      target.dataset.reveal = "";
      target.style.setProperty("--reveal-delay", `${Math.min(index % 4, 3) * 45}ms`);
      if (index < 2) target.dataset.revealVisible = "";
      else observer.observe(target);
    });
    el._revealObserver = observer;
  },
  unmounted(el) { el._revealObserver?.disconnect(); },
};
watch(
  () => state.user,
  (user) => {
    if (user) refresh();
  },
  { immediate: true },
);
async function logout() {
  try {
    await request("/api/auth/logout", { method: "POST" });
  } finally {
    state.user = null;
    router.replace("/login");
  }
}
</script>

<template>
  <RouterView v-if="route.path === '/login'" />
  <div v-else class="shell">
    <aside class="sidebar">
      <RouterLink to="/" class="brand"
        ><img
          class="brand-mark"
          src="/lab-mark.svg"
          alt=""
          aria-hidden="true"
        /><span
          ><strong>仓序 LAB</strong><small>实验室物资决策台</small></span
        ></RouterLink
      >
      <div class="nav-group-label">工作台</div>
      <nav class="side-nav" aria-label="主导航">
        <RouterLink to="/" exact-active-class="active"
          ><span>◫</span>运营总览</RouterLink
        >
        <RouterLink to="/inventory" active-class="active"
          ><span>▤</span>实时库存</RouterLink
        >
        <RouterLink v-if="operator" to="/operations" active-class="active"
          ><span>⇄</span>出入库</RouterLink
        >
        <RouterLink v-if="operator" to="/replenishments" active-class="active"
          ><span>◇</span>补货流程</RouterLink
        >
        <RouterLink v-if="approver" to="/approvals" active-class="active"
          ><span>✓</span>审批中心</RouterLink
        >
        <RouterLink to="/analytics" active-class="active"
          ><span>▥</span>数据分析</RouterLink
        >
        <RouterLink to="/advisor" active-class="active"
          ><span>✳</span>AI 决策台</RouterLink
        >
        <RouterLink to="/notifications" active-class="active"
          ><span>◉</span>消息中心
          <b v-if="state.unread" class="nav-count">{{
            state.unread
          }}</b></RouterLink
        >
        <RouterLink v-if="manager" to="/users" active-class="active"
          ><span>♧</span>账号管理</RouterLink
        >
        <RouterLink to="/security" active-class="active"
          ><span>⌁</span>安全设置</RouterLink
        >
      </nav>
      <div class="sidebar-foot">
        <span class="live-dot" :class="{ 'offline-dot': state.error }"></span><span>{{ state.error ? "服务连接中断" : "物资数据已连接" }}</span>
      </div>
    </aside>
    <div class="main-column">
      <header class="topbar">
        <div class="breadcrumb">仓序 <span>/</span> {{ title }}</div>
        <div class="top-actions">
          <button type="button" class="icon-button theme-toggle" :aria-label="theme === 'dark' ? '切换浅色界面' : '切换深色界面'" :aria-pressed="theme === 'dark'" @click="theme = theme === 'dark' ? 'light' : 'dark'">{{ theme === 'dark' ? '☀' : '☾' }}</button>
          <button
            type="button"
            class="icon-button"
            aria-label="刷新数据"
            :disabled="state.loading"
            @click="refresh"
          >
            ↻</button
          ><RouterLink
            to="/notifications"
            class="icon-button"
            aria-label="消息中心"
            >♧<i v-if="state.unread" class="notice-dot"></i></RouterLink
          ><RouterLink
            to="/security"
            class="user-chip"
            aria-label="安全设置与修改密码"
            >{{ state.user?.displayName }}
            <small>{{
              manager
                ? "主管"
                : state.user?.role === "DEPUTY"
                  ? "副主管"
                  : state.user?.role === "OPERATOR"
                    ? "仓管员"
                    : "观察员"
            }}</small></RouterLink
          ><button type="button" class="text-button" @click="logout">
            退出
          </button>
        </div>
      </header>
      <main class="page-content">
        <div v-if="state.error" class="alert error" role="alert">
          {{ state.error }} <button type="button" @click="refresh">重试</button>
        </div>
        <RouterView v-slot="{ Component }">
          <Transition name="page" mode="out-in">
            <div v-reveal :key="route.path" class="route-frame">
              <component :is="Component" />
            </div>
          </Transition>
        </RouterView>
      </main>
    </div>
  </div>
  <AiCompanion v-if="state.user && route.path !== '/login'" />
</template>
