<script setup>
import { ref } from "vue";
import { request, state } from "../api.js";

const form = ref({ currentPassword: "", newPassword: "", confirmPassword: "" });
const busy = ref(false);
const error = ref("");
const message = ref("");
async function changePassword() {
  error.value = "";
  message.value = "";
  if (form.value.newPassword !== form.value.confirmPassword) {
    error.value = "两次输入的新密码不一致";
    return;
  }
  busy.value = true;
  try {
    const result = await request("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({
        currentPassword: form.value.currentPassword,
        newPassword: form.value.newPassword,
      }),
    });
    message.value = result.message;
    form.value = { currentPassword: "", newPassword: "", confirmPassword: "" };
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
      <span class="overline">ACCOUNT SECURITY</span>
      <h1>安全设置</h1>
      <p>修改自己的登录密码，保护实验室物资数据。</p>
    </div>
  </div>
  <div class="security-layout">
    <section class="panel security-card">
      <div class="panel-head">
        <div>
          <span class="overline">PASSWORD</span>
          <h2>修改密码</h2>
        </div>
        <span class="security-lock" aria-hidden="true">◈</span>
      </div>
      <p class="security-intro">
        当前账号：{{ state.user?.displayName }}（{{ state.user?.username }}）
      </p>
      <form class="security-form" @submit.prevent="changePassword">
        <label
          >当前密码<input
            v-model="form.currentPassword"
            type="password"
            autocomplete="current-password"
            required
        /></label>
        <label
          >新密码<input
            v-model="form.newPassword"
            type="password"
            autocomplete="new-password"
            minlength="12"
            maxlength="128"
            required
        /></label>
        <label
          >再次输入新密码<input
            v-model="form.confirmPassword"
            type="password"
            autocomplete="new-password"
            minlength="12"
            maxlength="128"
            required
        /></label>
        <p class="security-tip">
          至少 12 位。修改成功后，其他设备上的登录会话会立即失效。
        </p>
        <p v-if="error" class="form-message error" role="alert">{{ error }}</p>
        <p v-if="message" class="form-message success" role="status">
          {{ message }}
        </p>
        <button class="primary-button" :disabled="busy">
          {{ busy ? "正在更新…" : "更新密码" }} <span>→</span>
        </button>
      </form>
    </section>
    <aside class="security-aside">
      <img src="/lab-mark.svg" alt="" />
      <span class="overline">RECOVERY PATH</span>
      <h2>忘记密码时</h2>
      <p>
        请联系主管或董事长在账号管理页重置。若管理账号无法登录，请由持有数据库管理员凭据的项目负责人执行本机恢复脚本。
      </p>
    </aside>
  </div>
</template>
