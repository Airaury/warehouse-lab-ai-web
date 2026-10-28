<script setup>
import { computed } from "vue";
import { RouterLink } from "vue-router";
import { state, time } from "../api.js";
import TrendChart from "../components/TrendChart.vue";
const items = computed(() => state.dashboard.items);
const low = computed(() =>
  items.value.filter((item) => item.quantity <= item.minQuantity),
);
const featured = computed(() => low.value[0] || items.value[0]);
const featuredTrend = computed(
  () => state.analytics.itemTrends?.[featured.value?.id] || [],
);
const pending = computed(
  () =>
    state.dashboard.approvals.length +
    state.dashboard.replenishments.filter((row) => row.status === "PENDING")
      .length,
);
const canOperate = computed(() => state.user?.role !== "VIEWER");
const maxZone = computed(() =>
  Math.max(1, ...state.analytics.zones.map((zone) => zone.quantity)),
);
</script>
<template>
  <div class="page-heading">
    <div>
      <span class="overline">OPERATIONS / LIVE</span>
      <h1>运营总览</h1>
      <p>今天的库存状态与待办事项，一眼掌握。</p>
    </div>
    <span class="snapshot">{{ time(state.dashboard.snapshotAt) }} 更新</span>
  </div>
  <div class="metric-grid">
    <RouterLink to="/inventory" class="metric-card"
      ><span>物资数量合计</span
      ><strong>{{ state.analytics.current.toLocaleString() }}</strong
      ><small>跨单位数值汇总</small><em>↗</em></RouterLink
    ><RouterLink to="/inventory" class="metric-card"
      ><span>管理物资</span><strong>{{ items.length }}</strong
      ><small>个 SKU</small><em>▤</em></RouterLink
    ><RouterLink to="/inventory" class="metric-card danger"
      ><span>低库存预警</span><strong>{{ low.length }}</strong
      ><small>需要安排补货</small><em>!</em></RouterLink
    ><RouterLink
      :to="
        canOperate && state.user?.role === 'MANAGER'
          ? '/approvals'
          : '/notifications'
      "
      class="metric-card"
      ><span>待审批申请</span><strong>{{ pending }}</strong
      ><small>出库与补货</small><em>◇</em></RouterLink
    >
  </div>
  <div class="overview-grid">
    <section class="panel trend-panel">
      <div class="panel-head">
        <div>
          <span class="overline">STOCK FLOW</span>
          <h2>{{ featured?.name || "物资" }}库存趋势</h2>
        </div>
        <RouterLink to="/analytics" class="subtle-link">查看分析 →</RouterLink>
      </div>
      <TrendChart :trend="featuredTrend" :unit="featured?.unit || '件'" />
    </section>
    <section class="panel">
      <div class="panel-head">
        <div>
          <span class="overline">NEEDS ATTENTION</span>
          <h2>需要关注</h2>
        </div>
        <span class="pill warn">{{ low.length }} 项</span>
      </div>
      <div v-if="low.length" class="attention-list">
        <RouterLink
          v-for="item in low.slice(0, 4)"
          :key="item.id"
          :to="canOperate ? '/replenishments' : '/inventory'"
          class="attention-row"
          ><span class="alert-icon">!</span
          ><span
            ><strong>{{ item.name }}</strong
            ><small>{{ item.sku }} · 阈值 {{ item.minQuantity }}</small></span
          ><b>{{ item.quantity }} {{ item.unit }}</b></RouterLink
        >
      </div>
      <p v-else class="empty">全部物资处于安全库存之上</p>
    </section>
  </div>
  <div class="overview-grid lower-grid">
    <section class="panel">
      <div class="panel-head">
        <div>
          <span class="overline">DISTRIBUTION</span>
          <h2>库区分布</h2>
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
          <span class="overline">RECENT ACTIVITY</span>
          <h2>最近操作</h2>
        </div>
        <RouterLink
          :to="canOperate ? '/operations' : '/analytics'"
          class="subtle-link"
          >{{ canOperate ? "进入操作" : "查看分析" }} →</RouterLink
        >
      </div>
      <div v-if="state.dashboard.movements.length" class="activity-list">
        <div
          v-for="row in state.dashboard.movements.slice(0, 4)"
          :key="row.id"
          class="activity-row"
        >
          <span class="activity-mark" :class="row.direction.toLowerCase()">{{
            row.direction === "IN" ? "↙" : "↗"
          }}</span
          ><span
            ><strong
              >{{ row.itemName }} ·
              {{ row.direction === "IN" ? "入库" : "出库" }}
              {{ row.quantity }}</strong
            ><small>{{ time(row.createdAt) }}</small></span
          >
        </div>
      </div>
      <p v-else class="empty">暂无出入库记录</p>
    </section>
  </div>
</template>
