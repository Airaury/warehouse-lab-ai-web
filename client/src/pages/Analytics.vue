<script setup>
import { computed, nextTick, ref } from "vue";
import { state } from "../api.js";
import TrendChart from "../components/TrendChart.vue";
import ZoneCharts from "../components/ZoneCharts.vue";
import RollingNumber from "../components/RollingNumber.vue";

const selectedItemId = ref("");
const trendSection = ref(null);
async function selectItem(id) {
  selectedItemId.value = id;
  if (id) {
    await nextTick();
    trendSection.value?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}
const selected = computed(() => state.dashboard.items.find((item) => String(item.id) === selectedItemId.value));
const trend = computed(() => state.analytics.itemTrends?.[selected.value?.id] || []);
const inbound = computed(() => trend.value.reduce((sum, row) => sum + row.inbound, 0));
const outbound = computed(() => trend.value.reduce((sum, row) => sum + row.outbound, 0));
const hasDemoSamples = computed(() => trend.value.some((row) => row.demo));
</script>

<template>
  <div class="page-heading">
    <div>
      <span class="overline">ANALYTICS / DRILL DOWN</span>
      <h1>数据分析</h1>
      <p>库区 → 物资 → 近 14 天库存走势，逐层定位异常。</p>
    </div>
  </div>
  <ZoneCharts :items="state.dashboard.items" :selected-item-id="selectedItemId" @select-item="selectItem" />
  <section ref="trendSection" class="panel analytics-chart analytics-trend-panel">
    <div class="panel-head">
      <div>
        <span class="overline">03 / STOCK HISTORY</span>
        <h2>{{ selected ? selected.name + "库存走势" : "选择物资查看库存走势" }}</h2>
        <p v-if="selected" class="analytics-item-meta">{{ selected.sku }} · {{ selected.zone }} · 安全阈值 {{ selected.minQuantity }} {{ selected.unit }}</p>
      </div>
      <span v-if="selected" class="pill" :class="{ warn: selected.quantity <= selected.minQuantity }">{{ selected.quantity <= selected.minQuantity ? "需要关注" : "库存正常" }}</span>
    </div>
    <template v-if="selected">
      <div class="analytics-item-metrics">
        <span>当前库存 <strong><RollingNumber :value="selected.quantity" /> <small>{{ selected.unit }}</small></strong></span>
        <span>14 天入库{{ hasDemoSamples ? " · 含演示" : "" }} <strong><RollingNumber :value="inbound" /> <small>{{ selected.unit }}</small></strong></span>
        <span>14 天出库{{ hasDemoSamples ? " · 含演示" : "" }} <strong><RollingNumber :value="outbound" /> <small>{{ selected.unit }}</small></strong></span>
      </div>
      <TrendChart :trend="trend" :unit="selected.unit" />
    </template>
    <div v-else class="analytics-trend-empty">
      <span>03</span><strong>等待物资选择</strong><p>先选择上方库区，再点击物资柱形。</p>
    </div>
  </section>
  <section class="panel analytics-risk">
    <div class="panel-head">
      <div><span class="overline">RISK WATCH</span><h2>低库存物资</h2></div>
      <span class="pill warn">{{ state.analytics.lowCount }}</span>
    </div>
    <div v-for="item in state.dashboard.items.filter((row) => row.quantity <= row.minQuantity)" :key="item.id" class="risk-row">
      <span><strong>{{ item.name }}</strong><small>{{ item.sku }} · {{ item.zone }}</small></span>
      <b>{{ item.quantity }} / {{ item.minQuantity }} {{ item.unit }}</b>
    </div>
    <p v-if="!state.analytics.lowCount" class="empty">暂无低库存物资</p>
  </section>
</template>
