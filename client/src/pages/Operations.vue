<script setup>
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { request, refresh, state, time } from "../api.js";

const route = useRoute();
const mode = ref(route.query.mode === "new" ? "new" : "movement");
const form = ref({ itemId: "", direction: "OUT", quantity: 1, note: "" });
const newItem = ref({ sku: "", name: "", category: "电子元件", zone: "A区", unit: "件", quantity: 1, minQuantity: 10, note: "" });
const busy = ref(false);
const error = ref("");
const message = ref("");
const directionFilter = ref("ALL");
const expanded = ref(false);
const selectedItem = computed(() =>
  state.dashboard.items.find((item) => String(item.id) === form.value.itemId),
);
const filteredMovements = computed(() =>
  state.dashboard.movements.filter(
    (row) =>
      directionFilter.value === "ALL" ||
      row.direction === directionFilter.value,
  ),
);
const visibleMovements = computed(() =>
  expanded.value
    ? filteredMovements.value
    : filteredMovements.value.slice(0, 5),
);
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
async function createItem() {
  busy.value = true;
  error.value = "";
  message.value = "";
  try {
    const result = await request("/api/items", {
      method: "POST",
      body: JSON.stringify({ ...newItem.value, quantity: Number(newItem.value.quantity), minQuantity: Number(newItem.value.minQuantity) }),
    });
    await refresh();
    form.value.itemId = String(result.id);
    form.value.direction = "IN";
    mode.value = "movement";
    message.value = result.message;
    newItem.value = { sku: "", name: "", category: "电子元件", zone: "A区", unit: "件", quantity: 1, minQuantity: 10, note: "" };
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
      <span class="overline">MATERIAL MOVEMENTS</span>
      <h1>出入库操作</h1>
      <p>现有物资出入库，或为新物资建档并完成首次入库。</p>
    </div>
  </div>
  <div class="two-column operations-layout">
    <section class="panel operation-form-panel">
      <div class="operation-tabs" role="group" aria-label="物资操作模式">
        <button type="button" :class="{ active: mode === 'movement' }" @click="mode = 'movement'; error = ''; message = ''">现有物资出入库</button>
        <button type="button" :class="{ active: mode === 'new' }" @click="mode = 'new'; error = ''; message = ''">新物资建档入库</button>
      </div>
      <template v-if="mode === 'movement'">
      <div class="panel-head">
        <div>
          <span class="overline">01 / NEW MOVEMENT</span>
          <h2>登记操作</h2>
        </div>
        <span class="operation-status">即时记录</span>
      </div>
      <p class="operation-subtitle">
        选择物资并填写数量，系统根据库存与审批规则处理。
      </p>
      <form class="field-grid" @submit.prevent="submit">
        <label class="wide"
          >物资
          <select v-model="form.itemId" required>
            <option value="" disabled>选择物资</option>
            <option
              v-for="item in state.dashboard.items"
              :key="item.id"
              :value="String(item.id)"
            >
              {{ item.name }} · {{ item.zone }} · 现存 {{ item.quantity }}
            </option>
          </select>
        </label>
        <div class="direction-choice wide" role="group" aria-label="操作类型">
          <button
            type="button"
            :class="{ active: form.direction === 'OUT' }"
            @click="form.direction = 'OUT'"
          >
            ↗ 出库领用
          </button>
          <button
            type="button"
            :class="{ active: form.direction === 'IN' }"
            @click="form.direction = 'IN'"
          >
            ↙ 入库登记
          </button>
        </div>
        <label
          >数量
          <input
            v-model.number="form.quantity"
            type="number"
            min="1"
            max="1000000"
            required
          />
        </label>
        <div class="stock-preview">
          <span>当前结存</span
          ><strong
            >{{ selectedItem?.quantity ?? "—" }}
            {{ selectedItem?.unit || "" }}</strong
          >
          <small>安全阈值 {{ selectedItem?.minQuantity ?? "—" }}</small>
        </div>
        <label class="wide"
          >备注
          <input
            v-model="form.note"
            maxlength="200"
            placeholder="例如：实验项目领用"
          />
        </label>
        <p class="operation-rule wide">
          {{
            form.direction === "OUT" && form.quantity > 50
              ? "本次出库超过 50，将先提交主管审批；批准后才扣减库存。"
              : form.direction === "OUT"
                ? "提交后立即扣减库存，并生成操作记录。"
                : "提交后立即增加库存，并生成操作记录。"
          }}
        </p>
        <p v-if="error" class="form-message error" role="alert">{{ error }}</p>
        <p v-if="message" class="form-message success" role="status">
          {{ message }}
        </p>
        <button
          class="primary-button scan-action"
          :disabled="busy || !state.dashboard.items.length"
        >
          {{ busy ? "提交中…" : "确认提交" }} <span>→</span>
        </button>
      </form>
      </template>
      <template v-else>
        <div class="panel-head">
          <div><span class="overline">01 / NEW MATERIAL</span><h2>新物资首次入库</h2></div>
          <span class="operation-status">建档 + 入库</span>
        </div>
        <p class="operation-subtitle">提交后同时建立物资档案和第一条入库记录。</p>
        <form class="field-grid" @submit.prevent="createItem">
          <label>物资编码<input v-model.trim="newItem.sku" required minlength="3" maxlength="40" pattern="[A-Za-z0-9_-]+" placeholder="例如 A-SENSOR-08" /></label>
          <label>物资名称<input v-model.trim="newItem.name" required maxlength="100" placeholder="例如 温湿度传感器" /></label>
          <label>分类<select v-model="newItem.category"><option>电子元件</option><option>设备</option><option>耗材</option><option>结构件</option><option>成品</option></select></label>
          <label>库区<select v-model="newItem.zone"><option v-for="zone in ['A区','B区','C区','D区','E区']" :key="zone">{{ zone }}</option></select></label>
          <label>计量单位<input v-model.trim="newItem.unit" required maxlength="20" placeholder="件 / 片 / 根" /></label>
          <label>首次入库数量<input v-model.number="newItem.quantity" type="number" min="1" max="1000000" required /></label>
          <label>安全阈值<input v-model.number="newItem.minQuantity" type="number" min="1" max="1000000" required /></label>
          <label class="wide">备注<input v-model.trim="newItem.note" maxlength="200" placeholder="例如 首次采购入库" /></label>
          <p v-if="error" class="form-message error wide" role="alert">{{ error }}</p>
          <p v-if="message" class="form-message success wide" role="status">{{ message }}</p>
          <button class="primary-button scan-action" :disabled="busy">{{ busy ? "提交中…" : "建档并入库" }} <span>→</span></button>
        </form>
      </template>
    </section>
    <section class="panel activity-panel">
      <div class="panel-head">
        <div>
          <span class="overline">02 / ACTIVITY</span>
          <h2>
            最近操作
            <span class="muted-count">{{
              state.dashboard.movements.length
            }}</span>
          </h2>
        </div>
      </div>
      <div class="record-filters" role="group" aria-label="筛选操作记录">
        <button
          v-for="option in [
            { value: 'ALL', label: '全部' },
            { value: 'IN', label: '入库' },
            { value: 'OUT', label: '出库' },
          ]"
          :key="option.value"
          type="button"
          :class="{ active: directionFilter === option.value }"
          @click="
            directionFilter = option.value;
            expanded = false;
          "
        >
          {{ option.label }}
        </button>
      </div>
      <div
        v-if="visibleMovements.length"
        class="activity-list compact-activity"
      >
        <div v-for="row in visibleMovements" :key="row.id" class="activity-row">
          <span class="activity-mark" :class="row.direction.toLowerCase()">{{
            row.direction === "IN" ? "↙" : "↗"
          }}</span>
          <span
            ><strong
              >{{ row.itemName }} ·
              {{ row.direction === "IN" ? "入库" : "出库" }} {{ row.quantity }}
              {{ row.unit }}</strong
            >
            <small>{{ row.note || "无备注" }}</small></span
          >
          <time>{{ time(row.createdAt) }}</time>
        </div>
      </div>
      <p v-else class="empty">当前筛选下暂无记录</p>
      <button
        v-if="filteredMovements.length > 5"
        type="button"
        class="record-more"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        {{
          expanded
            ? "收起记录"
            : `查看其余 ${filteredMovements.length - 5} 条最近记录`
        }}
        <span>{{ expanded ? "↑" : "↓" }}</span>
      </button>
    </section>
  </div>
</template>
