<script setup>
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { request, state } from "../api.js";
const route = useRoute(),
  router = useRouter();
const username = ref(""),
  password = ref(""),
  busy = ref(false),
  error = ref("");
async function login() {
  busy.value = true;
  error.value = "";
  try {
    state.user = (
      await request("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username: username.value,
          password: password.value,
        }),
      })
    ).user;
    password.value = "";
    router.replace(
      typeof route.query.redirect === "string" &&
        route.query.redirect.startsWith("/")
        ? route.query.redirect
        : "/",
    );
  } catch (err) {
    error.value = err.message;
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <div class="login-page">
    <div class="login-art">
      <div class="login-brand">
        <span class="brand-mark">序</span><strong>仓序</strong>
      </div>
      <div class="login-hero">
        <span class="overline">WAREHOUSE INTELLIGENCE</span>
        <h1>让每一次<br />库存决策<br />都有依据。</h1>
        <p>从预警、申请到审批与收货，把仓库业务连成一条清晰的工作线。</p>
      </div>
      <div class="login-graphic">
        <span class="graphic-line"></span
        ><span class="graphic-card card-one">库存实时可见 <b>●</b></span
        ><span class="graphic-card card-two">流程持续流转 <b>↗</b></span>
      </div>
    </div>
    <div class="login-form-wrap">
      <form class="login-card" @submit.prevent="login">
        <span class="overline">WELCOME BACK</span>
        <h2>登录工作台</h2>
        <p>使用已分配的仓库账号继续。</p>
        <label
          >账号<input
            v-model="username"
            autofocus
            autocomplete="username"
            required
            placeholder="输入账号" /></label
        ><label
          >密码<input
            v-model="password"
            type="password"
            autocomplete="current-password"
            required
            placeholder="输入密码"
        /></label>
        <p v-if="error" class="form-message error" role="alert">{{ error }}</p>
        <button class="primary-button full" :disabled="busy">
          {{ busy ? "正在登录…" : "登录仓序" }} <span>→</span>
        </button>
        <div class="login-roles">
          <span>仓管员 · 日常出入库</span><span>主管 · 审批与账号管理</span
          ><span>观察员 · 数据查看</span>
        </div>
      </form>
    </div>
  </div>
</template>
