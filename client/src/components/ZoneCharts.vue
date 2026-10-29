<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import Chart from "chart.js/auto";

const props = defineProps({
  items: { type: Array, default: () => [] },
  selectedItemId: { type: String, default: "" },
});
const emit = defineEmits(["select-item"]);
// Geometry, colors and Chart.js motion follow Experiment 2/index.html.
const colors = ["#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#ef4444", "#6366f1"];
const barCanvas = ref(null);
const pieCanvas = ref(null);
const metric = ref("all");
const selectedZone = ref("");
const dark = ref(false);
let barChart;
let pieChart;
let themeObserver;

const units = computed(() => [...new Set(props.items.map((item) => item.unit).filter(Boolean))].sort());
const zoneNames = computed(() => [...new Set(props.items.map((item) => item.zone).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN", { numeric: true })));
const filteredItems = computed(() => props.items.filter((item) => metric.value === "all" || item.unit === metric.value));
const zoneItems = computed(() => filteredItems.value.filter((item) => item.zone === selectedZone.value));
const format = (value) => Number(value).toLocaleString("zh-CN");
const quantity = (item) => Math.max(0, Number(item.quantity) || 0);
const zoneValue = (name) => filteredItems.value.filter((item) => item.zone === name).reduce((sum, item) => sum + quantity(item), 0);
const sortedZoneItems = computed(() => [...zoneItems.value].sort((a, b) => quantity(b) - quantity(a)));
const bars = computed(() => selectedZone.value
  ? sortedZoneItems.value.slice(0, 10)
      .map((item, index) => ({ key: String(item.id), label: item.name, value: quantity(item), color: colors[index % colors.length], item }))
  : zoneNames.value.map((name, index) => ({ key: name, label: name, value: zoneValue(name), color: colors[index % colors.length] })));
const slices = computed(() => selectedZone.value
  ? sortedZoneItems.value.map((item, index) => ({ key: String(item.id), label: item.name, value: quantity(item), color: colors[index % colors.length], item }))
  : zoneNames.value.map((name, index) => ({ key: name, label: name, value: zoneValue(name), color: colors[index % colors.length] })));

function chooseZone(name) {
  selectedZone.value = name;
  emit("select-item", "");
}
function chooseBar(index) {
  const entry = bars.value[index];
  if (!entry) return;
  if (entry.item) emit("select-item", String(entry.item.id));
  else chooseZone(entry.key);
}
function chooseSlice(index) {
  const entry = slices.value[index];
  if (!entry) return;
  if (entry.item) emit("select-item", String(entry.item.id));
  else chooseZone(entry.key);
}
function goBack() {
  chooseZone("");
}
function repaint() {
  if (!barChart || !pieChart) return;
  const grid = dark.value ? "rgba(192,225,205,.12)" : "rgba(128,128,128,.1)";
  const axis = dark.value ? "#9db8a8" : "#94a3b8";
  const border = dark.value ? "#d1e9db" : "#101820";
  barChart.data.labels = bars.value.map((entry) => entry.label);
  barChart.data.datasets[0].data = bars.value.map((entry) => entry.value);
  barChart.data.datasets[0].backgroundColor = bars.value.map((entry) => entry.color);
  barChart.data.datasets[0].borderColor = bars.value.map((entry) => entry.key === props.selectedItemId ? border : "transparent");
  barChart.data.datasets[0].borderWidth = bars.value.map((entry) => entry.key === props.selectedItemId ? 2 : 0);
  barChart.options.scales.x.ticks.color = axis;
  barChart.options.scales.y.ticks.color = axis;
  barChart.options.scales.y.grid.color = grid;
  barChart.update();
  pieChart.data.labels = slices.value.map((entry) => entry.label);
  pieChart.data.datasets[0].data = slices.value.map((entry) => entry.value);
  pieChart.data.datasets[0].backgroundColor = slices.value.map((entry) => entry.color);
  pieChart.data.datasets[0].borderColor = border;
  pieChart.data.datasets[0].borderWidth = slices.value.map((entry) => entry.key === props.selectedItemId ? 4 : 2);
  pieChart.update();
}
onMounted(async () => {
  await nextTick();
  dark.value = document.documentElement.dataset.theme === "dark";
  barChart = new Chart(barCanvas.value, {
    type: "bar",
    data: { labels: [], datasets: [{ label: "库存量", data: [], backgroundColor: [], borderRadius: 6 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 1000, easing: "easeOutQuart" },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (context) => {
          const item = bars.value[context.dataIndex]?.item;
          return ` ${format(context.parsed.y)}${item ? ` ${item.unit}` : metric.value === "all" ? "（跨单位数值）" : ` ${metric.value}`}`;
        } } },
      },
      scales: {
        y: { beginAtZero: true, ticks: { color: "#94a3b8", font: { size: 10 } }, grid: { color: "rgba(128,128,128,.1)" } },
        x: { ticks: { color: "#94a3b8", font: { size: 10 }, maxRotation: 0, autoSkip: true }, grid: { display: false } },
      },
      onClick: (_event, elements) => { if (elements.length) chooseBar(elements[0].index); },
      onHover: (_event, elements) => { barCanvas.value.style.cursor = elements.length ? "pointer" : "default"; },
    },
  });
  pieChart = new Chart(pieCanvas.value, {
    type: "doughnut",
    data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderWidth: 2 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 1000, easing: "easeOutQuart" },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (context) => {
          const item = slices.value[context.dataIndex]?.item;
          return ` ${context.label}: ${format(context.parsed)}${item ? ` ${item.unit}` : metric.value === "all" ? "（跨单位数值）" : ` ${metric.value}`}`;
        } } },
      },
      onClick: (_event, elements) => { if (elements.length) chooseSlice(elements[0].index); },
      onHover: (_event, elements) => { pieCanvas.value.style.cursor = elements.length ? "pointer" : "default"; },
    },
  });
  themeObserver = new MutationObserver(() => { dark.value = document.documentElement.dataset.theme === "dark"; });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  repaint();
});
watch([bars, slices, dark, () => props.selectedItemId], repaint, { flush: "post" });
watch(metric, () => chooseZone(""));
watch(zoneNames, (names) => { if (selectedZone.value && !names.includes(selectedZone.value)) chooseZone(""); });
onUnmounted(() => { themeObserver?.disconnect(); barChart?.destroy(); pieChart?.destroy(); });
</script>

<template>
  <section class="zone-visualization zone-replica" aria-labelledby="zone-viz-title">
    <div class="zone-viz-heading">
      <div class="zone-replica-title">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="2" y="14" width="3" height="4" rx=".5" fill="currentColor"/><rect x="7" y="8" width="3" height="10" rx=".5" fill="currentColor" opacity=".7"/><rect x="12" y="4" width="3" height="14" rx=".5" fill="currentColor" opacity=".4"/><rect x="17" y="10" width="3" height="8" rx=".5" fill="currentColor" opacity=".25"/></svg>
        <h2 id="zone-viz-title">数据可视化</h2>
      </div>
      <label class="zone-metric">统计口径
        <select v-model="metric" aria-label="图表统计口径">
          <option value="all">全部数量</option>
          <option v-for="unit in units" :key="unit" :value="unit">{{ unit }}</option>
        </select>
      </label>
    </div>
    <div class="zone-viz-grid">
      <section class="zone-chart-card">
        <div class="zone-chart-head">
          <h3>{{ selectedZone ? selectedZone + " 物资分布" : "各库区库存量" }}</h3>
          <button v-if="selectedZone" type="button" class="zone-back" @click="goBack">← 返回总览</button>
          <small v-else>点击柱子查看详情</small>
        </div>
        <div class="zone-chart-canvas"><canvas ref="barCanvas" role="img" :aria-label="selectedZone ? selectedZone + '物资数量柱状图' : '各库区库存量柱状图'"></canvas></div>
      </section>
      <section class="zone-chart-card zone-share-card">
        <div class="zone-chart-head"><h3>{{ selectedZone ? selectedZone + ' 物资占比' : '区域占比' }}</h3></div>
        <div class="zone-chart-canvas"><canvas ref="pieCanvas" role="img" :aria-label="selectedZone ? selectedZone + '物资占比环形图' : '区域占比环形图'"></canvas></div>
        <div class="zone-chart-legend" aria-label="点击图例查看详情">
          <button v-for="(entry, index) in slices" :key="entry.key" type="button" class="zone-legend-item"
            :class="{ selected: entry.key === selectedItemId }" :title="`${entry.label}：${format(entry.value)}${entry.item ? entry.item.unit : metric === 'all' ? '' : metric}`"
            @click="chooseSlice(index)"><span class="zone-legend-dot" :style="{ backgroundColor: entry.color }"></span>{{ entry.label }}</button>
        </div>
      </section>
    </div>
    <p class="zone-replica-note">{{ selectedZone ? "每块扇区按该物资的当前库存数量绘制；点击扇区、图例或柱形可查看趋势。" : "点击库区柱形或环形扇区可钻取。" }}{{ metric === "all" ? " 不同单位只比较数字大小，不作为可加总的库存总量。" : "" }}</p>
  </section>
</template>
