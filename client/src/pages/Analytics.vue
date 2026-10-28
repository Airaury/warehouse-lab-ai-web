<script setup>
import { computed, ref } from "vue";
import { state } from "../api.js";
import TrendChart from "../components/TrendChart.vue";
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
const inbound = computed(() =>
  trend.value.reduce((sum, row) => sum + row.inbound, 0),
);
const outbound = computed(() =>
  trend.value.reduce((sum, row) => sum + row.outbound, 0),
);
const maxZone = computed(() =>
  Math.max(1, ...state.analytics.zones.map((zone) => zone.quantity)),
);
</script>
<template>
  <div class="page-heading">
    <div>
      <span class="overline">ANALYTICS</span>
      <h1>数据分析</h1>
      <p>基于出入库记录观察近 14 天库存变化。</p>
    </div>
  </div>
  <div class="metric-grid three">
    <article class="metric-card">
      <span>{{ selected?.name || "物资" }}当前库存</span
      ><strong>{{ selected?.quantity || 0 }}</strong
      ><small>{{ selected?.unit || "件" }}</small>
    </article>
    <article class="metric-card">
      <span>14 天入库</span><strong>{{ inbound }}</strong
      ><small>{{ selected?.unit || "件" }}</small>
    </article>
    <article class="metric-card">
      <span>14 天出库</span><strong>{{ outbound }}</strong
      ><small>{{ selected?.unit || "件" }}</small>
    </article>
  </div>
  <section class="panel analytics-chart">
    <div class="panel-head">
      <div>
        <span class="overline">STOCK HISTORY</span>
        <h2>库存走势</h2>
      </div>
      <select
        v-model="selectedItemId"
        class="chart-select"
        aria-label="选择分析物资"
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
  <div class="two-column">
    <section class="panel">
      <div class="panel-head">
        <div>
          <span class="overline">DISTRIBUTION</span>
          <h2>库区库存</h2>
        </div>
      </div>
      <div class="zone-list">
        <div
          v-for="zone in state.analytics.zones"
          :key="zone.name"
          class="zone-row"
        >
          <span>{{ zone.name }}</span>
          <div class="bar-track">
            <div
              class="bar-fill"
              :style="{ width: `${(zone.quantity / maxZone) * 100}%` }"
            ></div>
          </div>
          <strong>{{ zone.quantity }}</strong>
        </div>
      </div>
    </section>
    <section class="panel">
      <div class="panel-head">
        <div>
          <span class="overline">RISK</span>
          <h2>低库存物资</h2>
        </div>
        <span class="pill warn">{{ state.analytics.lowCount }}</span>
      </div>
      <div
        v-for="item in state.dashboard.items.filter(
          (row) => row.quantity <= row.minQuantity,
        )"
        :key="item.id"
        class="risk-row"
      >
        <span
          ><strong>{{ item.name }}</strong
          ><small>{{ item.sku }}</small></span
        ><b>{{ item.quantity }} / {{ item.minQuantity }}</b>
      </div>
      <p v-if="!state.analytics.lowCount" class="empty">暂无低库存物资</p>
    </section>
  </div>
</template>
