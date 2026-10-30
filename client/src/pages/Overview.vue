<script setup>
import { computed, ref } from "vue";
import { RouterLink } from "vue-router";
import { request, state, time } from "../api.js";
import TrendChart from "../components/TrendChart.vue";
import RollingNumber from "../components/RollingNumber.vue";
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
  Math.max(1, ...state.analytics.zones.map((zone) => zone.skuCount)),
);
const safeCount = computed(() => items.value.length - low.value.length);
const activeOrders = computed(
  () =>
    state.dashboard.replenishments.filter((row) =>
      ["PENDING", "APPROVED"].includes(row.status),
    ).length,
);
const analyzing = ref(false);
const analysisError = ref("");
const latest = computed(() => state.latestPlan);
const planFresh = computed(() => latest.value && Date.now() - new Date(latest.value.snapshotAt).getTime() < 24 * 60 * 60 * 1000);
const remaining = computed(() => latest.value?.plan.items.filter((row) => !latest.value.applied?.includes(row.sku)) || []);
async function runAnalysis() {
  if (analyzing.value) return;
  analyzing.value = true;
  analysisError.value = "";
  try {
    state.latestPlan = await request("/api/ai/plans", {
      method: "POST",
      body: JSON.stringify({ question: "请核对实验室物资风险，按紧急程度形成可审核的补货草案。" }),
    });
  } catch (err) {
    analysisError.value = err.message;
  } finally {
    analyzing.value = false;
  }
}
</script>
<template>
  <section class="overview-hero warp-surface">
    <div class="hero-copy">
      <span class="hero-eyebrow"
        ><i class="live-dot"></i> LAB MATERIAL CONTROL / LIVE</span
      >
      <h1>让实验不停在<br /><em>缺料之前。</em></h1>
      <p>
        从实时库存发现风险，由 AI
        核对证据形成补货草案，再由团队完成确认、审批与收货。
      </p>
      <div class="hero-actions">
        <button type="button" class="hero-primary scan-action" :disabled="analyzing || !state.aiConfigured" @click="runAnalysis">{{ analyzing ? "正在核对库存…" : "运行 AI 风险分析" }} <span>↗</span></button>
        <RouterLink to="/inventory" class="hero-secondary"
          >查看实时库存 →</RouterLink
        >
      </div>
      <small
        >当前为演示物资数据 · {{ time(state.dashboard.snapshotAt) }} 更新</small
      >
    </div>
    <div class="hero-visual" aria-hidden="true">
      <div class="orbit orbit-one"></div>
      <div class="orbit orbit-two"></div>
      <div class="hero-core">
        <img src="/lab-mark.svg" alt="" /><strong>仓序 LAB</strong
        ><small>风险决策中枢</small>
      </div>
      <div class="orbit-chip chip-risk">
        <b><RollingNumber :value="low.length" /></b
        ><span>待关注风险</span>
      </div>
      <div class="orbit-chip chip-flow">
        <b><RollingNumber :value="activeOrders" /></b
        ><span>进行中补货</span>
      </div>
      <div class="orbit-chip chip-safe">
        <b><RollingNumber :value="safeCount" /></b
        ><span>安全物资</span>
      </div>
    </div>
  </section>
  <section v-if="state.user?.role === 'CHAIRMAN'" class="panel demo-route" aria-label="演示路线">
    <div class="demo-route-intro"><span class="overline">LIVE DEMO / BUSINESS LOOP</span><h2>董事长演示路线</h2><p>演示数据已标记。沿四个节点展示 AI、审批、出入库和消息如何联动。</p></div>
    <div class="demo-route-steps">
      <RouterLink to="/advisor"><b>01</b><strong>AI 风险决策</strong><small>读取证据 · 生成草案</small><span>↗</span></RouterLink>
      <RouterLink to="/approvals"><b>02</b><strong>多单审批</strong><small>{{ pending }} 项待审 · 批准或驳回</small><span>↗</span></RouterLink>
      <RouterLink to="/operations"><b>03</b><strong>出入库追踪</strong><small>批量领用 · 到货入库</small><span>↗</span></RouterLink>
      <RouterLink to="/notifications"><b>04</b><strong>消息与复盘</strong><small>{{ state.unread }} 条未读 · AI 总结</small><span>↗</span></RouterLink>
    </div>
  </section>
  <section class="ai-decision panel" aria-labelledby="ai-decision-title">
    <div class="ai-decision-head">
      <div><span class="overline">AI DECISION ENGINE / LIVE EVIDENCE</span><h2 id="ai-decision-title">今日决策建议</h2><p>AI 读取实时库存与流程状态，形成可追溯的建议；提交由人确认。</p></div>
      <span class="ai-engine-state"><i class="live-dot"></i>{{ state.aiConfigured ? "分析引擎在线" : "等待 AI 配置" }}</span>
    </div>
    <div class="decision-flow" aria-label="风险决策流程">
      <span><b>01</b> 实时库存</span><i></i><span><b>02</b> AI 核对</span><i></i><span><b>03</b> 人工确认</span><i></i><span><b>04</b> 审批收货</span>
    </div>
    <div v-if="analyzing" class="ai-decision-loading" role="status">正在读取库存、出入库记录与进行中的补货单…</div>
    <p v-if="analysisError" class="form-message error" role="alert">{{ analysisError }}</p>
    <div v-if="latest && !analyzing" class="ai-decision-result">
      <div class="ai-decision-summary"><span>草案 #{{ latest.id }} · {{ time(latest.snapshotAt) }} · {{ planFresh ? "可确认" : "已过期，建议重新分析" }}</span><strong>{{ latest.plan.summary }}</strong><small>已核对 {{ latest.trace?.length || 0 }} 次业务工具 · {{ latest.plan.items.length }} 项建议 · {{ remaining.length }} 项待确认</small></div>
      <div class="ai-decision-items">
        <span v-for="row in latest.plan.items.slice(0, 3)" :key="row.sku"><i :class="row.priority"></i><b>{{ row.name }}</b><small>{{ row.current }} / 阈值 {{ row.minQuantity }} {{ row.unit }}</small></span>
        <p v-if="!latest.plan.items.length">当前没有需要新增申请的低库存物资。</p>
      </div>
      <RouterLink to="/advisor" class="ai-decision-link">查看证据与逐项确认 →</RouterLink>
    </div>
    <div v-else-if="!analyzing" class="ai-decision-empty"><strong>先让 AI 核对风险，再决定下一步</strong><p>上方“运行 AI 风险分析”会生成真实草案和工具调用记录。</p></div>
  </section>
  <div class="page-heading">
    <div>
      <span class="overline">TODAY'S SIGNALS</span>
      <h2>今日物资态势</h2>
      <p>风险、流程和库存变化保持同步。</p>
    </div>
    <span class="snapshot">{{ time(state.dashboard.snapshotAt) }} 更新</span>
  </div>
  <div class="metric-grid">
    <RouterLink to="/inventory" class="metric-card"
      ><span>安全物资</span><strong><RollingNumber :value="safeCount" /></strong
      ><small>高于安全阈值的 SKU</small><em>↗</em></RouterLink
    ><RouterLink to="/inventory" class="metric-card"
      ><span>管理物资</span><strong><RollingNumber :value="items.length" /></strong
      ><small>个 SKU</small><em>▤</em></RouterLink
    ><RouterLink to="/inventory" class="metric-card danger"
      ><span>低库存预警</span><strong><RollingNumber :value="low.length" /></strong
      ><small>包含阈值临界物资</small><em>!</em></RouterLink
    ><RouterLink
      :to="
        canOperate && ['CHAIRMAN', 'MANAGER', 'DEPUTY'].includes(state.user?.role)
          ? '/approvals'
          : '/notifications'
      "
      class="metric-card"
      ><span>待审批申请</span><strong><RollingNumber :value="pending" /></strong
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
          <h2>库区物资种类</h2>
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
              :style="{ width: `${(zone.skuCount / maxZone) * 100}%` }"
            ></div>
          </div>
          <strong>{{ zone.skuCount }}</strong>
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
