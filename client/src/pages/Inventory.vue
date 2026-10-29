<script setup>
import { computed, ref } from "vue";
import { RouterLink } from "vue-router";
import { state } from "../api.js";
import TrendChart from "../components/TrendChart.vue";
import RollingNumber from "../components/RollingNumber.vue";
const search = ref(""),
  zone = ref("全部库区"),
  status = ref("全部状态");
const selectedItemId = ref("");
const selected = computed(
  () =>
    state.dashboard.items.find(
      (item) => String(item.id) === selectedItemId.value,
    ) || state.dashboard.items[0],
);
const trend = computed(
  () => state.analytics.itemTrends?.[selected.value?.id] || [],
);
const zones = computed(() => [
  "全部库区",
  ...new Set(state.dashboard.items.map((item) => item.zone)),
]);
const items = computed(() =>
  state.dashboard.items.filter((item) => {
    const term = search.value.trim().toLowerCase();
    return (
      (!term ||
        `${item.name} ${item.sku} ${item.category}`
          .toLowerCase()
          .includes(term)) &&
      (zone.value === "全部库区" || zone.value === item.zone) &&
      (status.value === "全部状态" ||
        (status.value === "需关注") === item.quantity <= item.minQuantity)
    );
  }),
);
</script>
<template>
  <div class="page-heading">
    <div>
      <span class="overline">INVENTORY</span>
      <h1>实时库存</h1>
      <p>关注数量、库区和安全阈值。</p>
    </div>
    <div v-if="state.user?.role !== 'VIEWER'" class="inventory-actions">
      <RouterLink to="/operations?mode=new" class="hero-secondary">新增物资入库 →</RouterLink>
      <RouterLink to="/replenishments" class="primary-button">发起补货 <span>→</span></RouterLink>
    </div>
  </div>
  <section class="panel compact-chart">
    <div class="panel-head">
      <div>
        <span class="overline">LAST 14 DAYS</span>
        <h2>{{ selected?.name || "物资" }}库存趋势</h2>
      </div>
      <select
        v-model="selectedItemId"
        class="chart-select"
        aria-label="选择趋势物资"
      >
        <option value="">
          {{ state.dashboard.items[0]?.name || "选择物资" }}
        </option>
        <option
          v-for="item in state.dashboard.items.slice(1)"
          :key="item.id"
          :value="String(item.id)"
        >
          {{ item.name }}
        </option>
      </select>
    </div>
    <TrendChart :trend="trend" :unit="selected?.unit || '件'" />
  </section>
  <section class="panel">
    <div class="panel-head inventory-header">
      <div>
        <span class="overline">ITEMS</span>
        <h2>
          物资清单 <span class="muted-count"><RollingNumber :value="items.length" /></span>
        </h2>
      </div>
      <div class="filters">
        <input
          v-model="search"
          type="search"
          aria-label="搜索物资"
          placeholder="搜索物资 / SKU"
        /><select v-model="zone" aria-label="筛选库区">
          <option v-for="name in zones" :key="name">{{ name }}</option></select
        ><select v-model="status" aria-label="筛选状态">
          <option>全部状态</option>
          <option>需关注</option>
          <option>正常</option>
        </select>
      </div>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>物资 / SKU</th>
            <th>分类</th>
            <th>库区</th>
            <th>当前库存</th>
            <th>安全阈值</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item.id">
            <td>
              <strong>{{ item.name }}</strong
              ><small>{{ item.sku }}</small>
            </td>
            <td>{{ item.category }}</td>
            <td>{{ item.zone }}</td>
            <td>
              <b>{{ item.quantity }}</b> {{ item.unit }}
            </td>
            <td>{{ item.minQuantity }} {{ item.unit }}</td>
            <td>
              <span
                class="pill"
                :class="item.quantity <= item.minQuantity ? 'warn' : 'good'"
                >{{
                  item.quantity <= item.minQuantity ? "需关注" : "正常"
                }}</span
              >
            </td>
          </tr>
          <tr v-if="!items.length">
            <td colspan="6" class="empty-table">没有匹配的物资</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
