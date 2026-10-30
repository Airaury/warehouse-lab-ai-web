<script setup>
import { onMounted, ref } from "vue";
import { request, state } from "../api.js";
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
const action = ref(null);
const actionPassword = ref("");
const actionError = ref("");
const actionBusy = ref(false);
const actionMessage = ref("");
const isChairman = () => state.user?.role === "CHAIRMAN";
const canManageUser = (user) =>
  user.id !== state.user?.id &&
  user.role !== "CHAIRMAN" &&
  (isChairman() || user.role !== "MANAGER");
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
function openAction(type, user) {
  action.value = { type, user };
  actionPassword.value = "";
  actionError.value = "";
}
async function confirmAction() {
  if (!action.value || actionBusy.value) return;
  actionBusy.value = true;
  actionError.value = "";
  actionMessage.value = "";
  try {
    const { type, user } = action.value;
    const result =
      type === "delete"
        ? await request(`/api/users/${user.id}`, { method: "DELETE" })
        : await request(`/api/users/${user.id}/reset-password`, {
            method: "POST",
            body: JSON.stringify({ newPassword: actionPassword.value }),
          });
    actionMessage.value = result.message;
    action.value = null;
    actionPassword.value = "";
    await loadUsers();
  } catch (err) {
    actionError.value = err.message;
  } finally {
    actionBusy.value = false;
  }
}
</script>
<template>
  <div class="page-heading">
    <div>
      <span class="overline">ACCESS</span>
      <h1>账号管理</h1>
      <p>按岗位分配权限，账号变更与历史业务记录可追溯。</p>
    </div>
  </div>
  <p v-if="actionMessage" class="alert success" role="status">
    {{ actionMessage }}
  </p>
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
            <option v-if="isChairman()" value="MANAGER">主管</option>
            <option value="OPERATOR">仓管员</option>
            <option value="DEPUTY">副主管</option>
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
        <span>董事长</span>
        <p>统筹全部业务，可管理主管和其他岗位账号。</p>
      </div>
      <div class="role-row">
        <span>主管</span>
        <p>审批出库与补货、管理账号、执行操作和查看分析。</p>
      </div>
      <div class="role-row">
        <span>副主管</span>
        <p>审批出库与补货、执行操作和查看分析；不能管理账号。</p>
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
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.id">
            <td>{{ user.username }}</td>
            <td>{{ user.displayName }}</td>
            <td>
              {{
                {
                  MANAGER: "主管",
                  CHAIRMAN: "董事长",
                  DEPUTY: "副主管",
                  OPERATOR: "仓管员",
                  VIEWER: "观察员",
                }[user.role]
              }}
            </td>
            <td>
              <div v-if="canManageUser(user)" class="user-actions">
                <button type="button" @click="openAction('reset', user)">
                  重置密码
                </button>
                <button
                  type="button"
                  class="danger-text"
                  @click="openAction('delete', user)"
                >
                  删除
                </button>
              </div>
              <span v-else class="self-label">{{ user.id === state.user?.id ? "当前账号" : "无权操作" }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
  <div v-if="action" class="confirm-backdrop" @click.self="action = null">
    <div
      class="confirm-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-action-title"
    >
      <span class="overline">ACCOUNT CONTROL</span>
      <h2 id="user-action-title">
        {{ action.type === "delete" ? "删除账号" : "重置密码" }}
      </h2>
      <p>
        <strong>{{ action.user.displayName }}</strong> ·
        {{ action.user.username }}
      </p>
      <template v-if="action.type === 'delete'">
        <p>
          删除后该账号无法登录，所有会话立即失效；已有审批与补货记录仍保留用于追溯。
        </p>
      </template>
      <template v-else>
        <p>请当面告知使用者新密码。重置后原有登录会话会失效。</p>
        <label class="modal-field"
          >新密码
          <input
            v-model="actionPassword"
            type="password"
            autocomplete="new-password"
            minlength="12"
            maxlength="128"
            placeholder="至少 12 位"
          />
        </label>
      </template>
      <p v-if="actionError" class="form-message error" role="alert">
        {{ actionError }}
      </p>
      <div class="confirm-actions">
        <button type="button" class="text-button" @click="action = null">
          取消
        </button>
        <button
          type="button"
          class="primary-button"
          :class="{ 'danger-button': action.type === 'delete' }"
          :disabled="
            actionBusy ||
            (action.type === 'reset' && actionPassword.length < 12)
          "
          @click="confirmAction"
        >
          {{
            actionBusy
              ? "处理中…"
              : action.type === "delete"
                ? "确认删除"
                : "确认重置"
          }}
        </button>
      </div>
    </div>
  </div>
</template>
