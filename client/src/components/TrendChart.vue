<script setup>
import { computed } from "vue";
const props = defineProps({
  trend: { type: Array, default: () => [] },
  unit: { type: String, default: "件" },
});
const values = computed(() => props.trend.map((row) => Number(row.quantity)));
const min = computed(() => Math.max(0, Math.min(...values.value, 0) - 10));
const max = computed(() => Math.max(...values.value, 1) + 10);
const points = computed(() =>
  values.value
    .map((value, i) => {
      const x = 42 + (i * 680) / Math.max(1, values.value.length - 1);
      const y = 218 - ((value - min.value) / (max.value - min.value)) * 174;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" "),
);
const area = computed(() =>
  points.value ? `42,218 ${points.value} 722,218` : "",
);
</script>
<template>
  <div class="chart-wrap" v-if="trend.length">
    <svg
      viewBox="0 0 760 252"
      role="img"
      :aria-label="`近14天库存趋势，当前 ${trend.at(-1)?.quantity || 0} ${unit}`"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#35b782" stop-opacity=".22" />
          <stop offset="1" stop-color="#35b782" stop-opacity="0" />
        </linearGradient>
      </defs>
      <path
        v-for="y in [45, 102, 160, 218]"
        :key="y"
        :d="`M 42 ${y} H 722`"
        stroke="#e5eae6"
        stroke-dasharray="4 6"
      />
      <polygon :points="area" fill="url(#chartFill)" />
      <polyline
        :points="points"
        fill="none"
        stroke="#258d66"
        stroke-width="3.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        vector-effect="non-scaling-stroke"
      />
      <circle
        v-for="(row, i) in trend"
        :key="row.day"
        :cx="42 + (i * 680) / Math.max(1, trend.length - 1)"
        :cy="218 - ((row.quantity - min) / (max - min)) * 174"
        r="3"
        fill="#fff"
        stroke="#258d66"
        stroke-width="2"
      >
        <title>
          {{ row.day }} · 结存 {{ row.quantity }} {{ unit }} · 入库
          {{ row.inbound }} · 出库 {{ row.outbound }}
        </title>
      </circle>
      <text x="42" y="244">{{ trend[0]?.day.slice(5) }}</text>
      <text x="722" y="244" text-anchor="end">
        {{ trend.at(-1)?.day.slice(5) }}
      </text>
    </svg>
    <div class="chart-data">
      <span>期初 {{ trend[0]?.quantity }}</span
      ><span>当前 {{ trend.at(-1)?.quantity }}</span>
    </div>
  </div>
  <p v-else class="empty">暂无趋势数据</p>
</template>
