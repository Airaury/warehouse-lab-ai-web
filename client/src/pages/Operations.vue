<script setup>
import { ref, watch } from "vue";
import { request, refresh, state, time } from "../api.js";
const form = ref({ itemId: "", direction: "OUT", quantity: 1, note: "" });
const busy = ref(false),
  error = ref(""),
  message = ref("");
watch(
  () => state.dashboard.items,
  (items) => {
    if (!form.value.itemId && items.length)
      form.value.itemId = String(items[0].id);
  },
  { immediate: true },
);
async function submit() {
  busy.value = true;
  error.value = "";
  message.value = "";
  try {
    const result = await request("/api/movements", {
      method: "POST",
      body: JSON.stringify({
        ...form.value,
        itemId: Number(form.value.itemId),
        quantity: Number(form.value.quantity),
      }),
    });
    message.value = result.message;
    form.value.note = "";
    form.value.quantity = 1;
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
      <span class="overline">MOVEMENTS</span>
      <h1>出入库操作</h1>
      <p>大额出库自动流转到主管审批。</p>
    </div>
  </div>
  <div class="two-column">
    <section class="panel">
      <div class="panel-head">
        <div>
          <span class="overline">NEW MOVEMENT</span>
          <h2>登记操作</h2>
        </div>
      </div>
      <form class="field-grid" @submit.prevent="submit">
        <label class="wide"
          >物资<select v-model="form.itemId" required>
            <option value="" disabled>选择物资</option>
            <option
              v-for="item in state.dashboard.items"
              :key="item.id"
              :value="String(item.id)"
            >
              {{ item.name }} · {{ item.zone }} · 现存 {{ item.quantity }}
            </option>
          </select></label
        ><label
          >类型<select v-model="form.direction">
            <option value="OUT">出库</option>
            <option value="IN">入库</option>
          </select></label
        ><label
          >数量<input
            v-model.number="form.quantity"
            type="number"
            min="1"
            max="1000000"
            required /></label
        ><label class="wide"
          >备注<input
            v-model="form.note"
            maxlength="200"
            placeholder="例如：生产线领用"
        /></label>
        <p v-if="error" class="form-message error" role="alert">{{ error }}</p>
        <p v-if="message" class="form-message success" role="status">
          {{ message }}
        </p>
        <button
          class="primary-button"
          :disabled="busy || !state.dashboard.items.length"
        >
          {{ busy ? "提交中…" : "确认提交" }} <span>→</span>
        </button>
      </form>
    </section>
    <section class="panel">
      <div class="panel-head">
        <div>
          <span class="overline">ACTIVITY</span>
          <h2>操作记录</h2>
        </div>
      </div>
      <div v-if="state.dashboard.movements.length" class="activity-list">
        <div
          v-for="row in state.dashboard.movements"
          :key="row.id"
          class="activity-row"
        >
          <span class="activity-mark" :class="row.direction.toLowerCase()">{{
            row.direction === "IN" ? "↙" : "↗"
          }}</span
          ><span
            ><strong
              >{{ row.itemName }} ·
              {{ row.direction === "IN" ? "入库" : "出库" }} {{ row.quantity }}
              {{ row.unit }}</strong
            ><small>{{ row.note || "无备注" }}</small></span
          ><time>{{ time(row.createdAt) }}</time>
        </div>
      </div>
      <p v-else class="empty">暂无记录</p>
    </section>
  </div>
</template>
