<script setup>
import { onMounted, ref } from "vue";
import { request } from "../api.js";
const form = ref({
  username: "",
  displayName: "",
  role: "OPERATOR",
  password: "",
});
const busy = ref(false),
  error = ref(""),
  message = ref("");
const users = ref([]);
async function loadUsers() {
  try {
    users.value = (await request("/api/users")).users;
  } catch (err) {
    error.value = err.message;
  }
}
onMounted(loadUsers);
async function submit() {
  busy.value = true;
  error.value = "";
  message.value = "";
  try {
    message.value = (
      await request("/api/users", {
        method: "POST",
        body: JSON.stringify(form.value),
      })
    ).message;
    form.value = {
      username: "",
      displayName: "",
      role: "OPERATOR",
      password: "",
    };
    await loadUsers();
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
      <span class="overline">ACCESS</span>
      <h1>账号管理</h1>
      <p>按岗位分配最小必要权限。</p>
    </div>
  </div>
  <div class="two-column">
    <section class="panel">
      <div class="panel-head">
        <div>
          <span class="overline">NEW USER</span>
          <h2>创建账号</h2>
        </div>
      </div>
      <form class="field-grid" @submit.prevent="submit">
        <label
          >登录账号<input
            v-model="form.username"
            pattern="[A-Za-z][A-Za-z0-9_]{2,29}"
            autocomplete="off"
            required
            placeholder="例如 operator01" /></label
        ><label
          >显示名称<input
            v-model="form.displayName"
            maxlength="60"
            required
            placeholder="例如 仓管员张三" /></label
        ><label
          >岗位角色<select v-model="form.role">
            <option value="OPERATOR">仓管员</option>
            <option value="MANAGER">主管</option>
            <option value="VIEWER">观察员</option>
          </select></label
        ><label
          >初始密码<input
            v-model="form.password"
            type="password"
            minlength="12"
            maxlength="128"
            autocomplete="new-password"
            required
            placeholder="至少 12 位"
        /></label>
        <p v-if="error" class="form-message error" role="alert">{{ error }}</p>
        <p v-if="message" class="form-message success" role="status">
          {{ message }}
        </p>
        <button class="primary-button" :disabled="busy">
          创建账号 <span>→</span>
        </button>
      </form>
    </section>
    <section class="panel">
      <div class="panel-head">
        <div>
          <span class="overline">ROLES</span>
          <h2>岗位权限</h2>
        </div>
      </div>
      <div class="role-row">
        <span>主管</span>
        <p>审批出库与补货、管理账号、执行操作和查看分析。</p>
      </div>
      <div class="role-row">
        <span>仓管员</span>
        <p>登记出入库、申请补货、确认收货和查看分析。</p>
      </div>
      <div class="role-row">
        <span>观察员</span>
        <p>查看库存、统计、消息与 AI 分析，不修改业务数据。</p>
      </div>
    </section>
  </div>
  <section class="panel user-list-panel">
    <div class="panel-head">
      <div>
        <span class="overline">TEAM</span>
        <h2>当前账号</h2>
      </div>
      <span class="pill">{{ users.length }}</span>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>账号</th>
            <th>姓名</th>
            <th>岗位</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.id">
            <td>{{ user.username }}</td>
            <td>{{ user.displayName }}</td>
            <td>
              {{
                { MANAGER: "主管", OPERATOR: "仓管员", VIEWER: "观察员" }[
                  user.role
                ]
              }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
