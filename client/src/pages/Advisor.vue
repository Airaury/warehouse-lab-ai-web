<script setup>
import { computed, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import { refresh, request, state, time } from "../api.js";

const question = ref("请核对实验室物资风险，按紧急程度形成可审核的补货草案。");
const mode = ref("plan");
const planRun = ref(state.latestPlan);
const answer = ref("");
const answerAt = ref("");
const error = ref("");
const success = ref("");
const busy = ref(false);
const confirmSku = ref("");
const applying = ref(false);
const applied = ref(state.latestPlan?.applied || []);
watch(() => state.latestPlan, (run) => {
  if (run && !planRun.value) {
    planRun.value = run;
    applied.value = run.applied || [];
  }
});
const selected = computed(() =>
  planRun.value?.plan.items.find((row) => row.sku === confirmSku.value),
);
const canApply = computed(() => state.user?.role !== "VIEWER");
const toolLabels = {
  list_stock_risks: "实时库存与阈值",
  get_movement_history: "真实出入库记录",
  list_open_replenishments: "进行中的补货单",
};
const examples = [
  "请核对实验室物资风险，按紧急程度形成可审核的补货草案。",
  "请重点检查低库存物资，并说明近期出入库记录是否足以判断需求。",
  "哪些物资已有进行中的补货单？请避免重复申请。",
];
async function analyze() {
  if (!question.value.trim()) return;
  busy.value = true;
  error.value = "";
  success.value = "";
  planRun.value = null;
  answer.value = "";
  applied.value = [];
  try {
    if (mode.value === "plan") {
      planRun.value = await request("/api/ai/plans", {
        method: "POST",
        body: JSON.stringify({ question: question.value.trim() }),
      });
      state.latestPlan = planRun.value;
    } else {
      const result = await request("/api/ai/advice", {
        method: "POST",
        body: JSON.stringify({ question: question.value.trim() }),
      });
      answer.value = result.answer;
      answerAt.value = result.snapshotAt;
    }
  } catch (err) {
    error.value = err.message;
  } finally {
    busy.value = false;
  }
}
async function apply() {
  if (!selected.value || applying.value) return;
  applying.value = true;
  error.value = "";
  success.value = "";
  try {
    const result = await request(`/api/ai/plans/${planRun.value.id}/apply`, {
      method: "POST",
      body: JSON.stringify({ sku: confirmSku.value }),
    });
    applied.value = [...applied.value, confirmSku.value];
    state.latestPlan = { ...planRun.value, applied: applied.value };
    success.value = `${selected.value.name}：已提交补货 ${result.quantity} ${selected.value.unit}，等待主管审批。`;
    confirmSku.value = "";
    await refresh();
  } catch (err) {
    error.value = err.message;
    confirmSku.value = "";
  } finally {
    applying.value = false;
  }
}
</script>

<template>
  <div class="page-heading">
    <div>
      <span class="overline">LAB MATERIAL INTELLIGENCE</span>
      <h1>物资风险决策台</h1>
      <p>只读工具核对业务数据，AI 形成草案；申请须由人确认并经过主管审批。</p>
    </div>
  </div>
  <div class="advisor-layout">
    <section class="advisor-panel invoke-panel" :class="{ 'is-busy': busy }">
      <div class="invoke-beams" aria-hidden="true"></div>
      <span class="invoke-status"
        ><i class="live-dot"></i
        >{{ state.aiConfigured ? "分析核心已就绪" : "等待模型配置" }}</span
      >
      <div class="advisor-ident">
        <span class="advisor-symbol"><img src="/lab-mark.svg" alt="" /></span>
        <div>
          <span class="overline">RISK ANALYST</span>
          <h2>实验室物资分析师</h2>
          <p>事实优先 · 数字可查 · 审批留痕</p>
        </div>
      </div>
      <div class="advisor-mode" role="group" aria-label="分析模式">
        <button
          type="button"
          :class="{ active: mode === 'plan' }"
          @click="mode = 'plan'"
        >
          生成补货草案
        </button>
        <button
          type="button"
          :class="{ active: mode === 'ask' }"
          @click="mode = 'ask'"
        >
          问答分析
        </button>
      </div>
      <p class="advisor-hint">
        {{
          mode === "plan"
            ? "AI 核对库存与补货单，按需读取出入库；建议数量由服务端按阈值规则计算。"
            : "针对当前业务快照提问，获得带 SKU 与数字依据的文字分析。"
        }}
      </p>
      <div class="prompt-options">
        <button
          v-for="example in examples"
          :key="example"
          type="button"
          @click="question = example"
        >
          {{ example }}
        </button>
      </div>
      <label for="question" class="field-label">分析任务</label>
      <textarea
        id="question"
        v-model="question"
        maxlength="500"
        rows="5"
        placeholder="例如：请核对低库存物资，并形成补货草案…"
      ></textarea>
      <div class="advisor-submit">
        <span>{{ question.length }} / 500</span>
        <button
          class="primary-button scan-action"
          type="button"
          :disabled="busy || !state.aiConfigured || !question.trim()"
          @click="analyze"
        >
          {{
            busy ? "正在核对…" : mode === "plan" ? "运行风险分析" : "获取分析"
          }}
          <span>↗</span>
        </button>
      </div>
      <p v-if="!state.aiConfigured" class="form-message error">
        AI 服务尚未配置
      </p>
      <p v-if="error" class="form-message error" role="alert">{{ error }}</p>
      <p v-if="success" class="form-message success" role="status">
        {{ success }}
      </p>
      <div class="advisor-guardrails">
        <span>01 · 只读取数</span><span>02 · 人工确认</span
        ><span>03 · 主管审批</span>
      </div>
    </section>

    <section class="panel answer-panel">
      <div class="panel-head">
        <div>
          <span class="overline">DECISION RECORD</span>
          <h2>分析记录</h2>
        </div>
        <span v-if="planRun || answerAt" class="snapshot">{{
          time(planRun?.snapshotAt || answerAt)
        }}</span>
      </div>
      <div
        v-if="busy"
        class="analysis-loading"
        role="status"
        aria-live="polite"
      >
        <img class="analysis-orbit" src="/lab-mark.svg" alt="" />
        <strong>正在核对库存与补货状态</strong>
        <p>模型响应后会显示实际使用的工具和可审核的结果。</p>
        <div class="loading-line"><span></span></div>
      </div>
      <Transition name="result" mode="out-in">
        <div v-if="planRun && !busy" :key="planRun.id" class="plan-result">
          <div class="plan-summary">
            <span class="plan-seal">AI 草案 #{{ planRun.id }}</span>
            <h3>{{ planRun.plan.summary }}</h3>
            <p>
              草案只包含当前低库存且无进行中补货的物资。提交时重新校验实时库存。
            </p>
          </div>
          <div class="tool-trace">
            <span class="overline">已调用的只读工具</span>
            <div class="trace-list">
              <span v-for="(step, index) in planRun.trace" :key="index">
                <b>{{ String(index + 1).padStart(2, "0") }}</b>
                {{ toolLabels[step.name] || step.name }}
                <small v-if="step.args?.sku">{{ step.args.sku }}</small>
              </span>
            </div>
          </div>
          <div class="plan-section-title">
            <strong>建议申请</strong
            ><span>{{ planRun.plan.items.length }} 项</span>
          </div>
          <div v-if="planRun.plan.items.length" class="plan-items">
            <article
              v-for="row in planRun.plan.items"
              :key="row.sku"
              class="plan-item"
            >
              <div class="plan-item-top">
                <span class="priority" :class="row.priority">{{
                  row.priority === "HIGH"
                    ? "优先处理"
                    : row.priority === "MEDIUM"
                      ? "建议处理"
                      : "持续观察"
                }}</span>
                <code>{{ row.sku }}</code>
              </div>
              <h3>{{ row.name }}</h3>
              <div class="plan-numbers">
                <span
                  >现存 <b>{{ row.current }}</b></span
                >
                <span
                  >阈值 <b>{{ row.minQuantity }}</b></span
                >
                <span
                  >建议补货 <b>{{ row.quantity }} {{ row.unit }}</b></span
                >
              </div>
              <p>{{ row.reason }}</p>
              <ul v-if="row.evidence.length" class="evidence-list">
                <li v-for="entry in row.evidence" :key="entry">{{ entry }}</li>
              </ul>
              <button
                v-if="canApply"
                type="button"
                class="plan-apply"
                :disabled="applied.includes(row.sku)"
                @click="confirmSku = row.sku"
              >
                {{
                  applied.includes(row.sku) ? "已提交审批" : "确认申请补货 →"
                }}
              </button>
              <small v-else class="viewer-note"
                >观察员可查看草案，申请由仓管员或主管提交</small
              >
            </article>
          </div>
          <p v-else class="empty">
            当前没有可提交的低库存物资。请查看已进行中的补货单。
          </p>
          <div v-if="planRun.plan.excludedOpen.length" class="plan-note">
            已排除进行中的补货：{{
              planRun.plan.excludedOpen.map((row) => row.sku).join("、")
            }}
          </div>
          <div v-if="planRun.plan.omittedEligible?.length" class="plan-note">
            AI 未纳入的低库存物资：{{
              planRun.plan.omittedEligible.join("、")
            }}。请人工查看实时库存。
          </div>
          <div class="plan-foot">
            <strong>校验与边界</strong>
            <p>{{ planRun.plan.rule }}</p>
            <p v-for="line in planRun.plan.limitations" :key="line">
              {{ line }}
            </p>
            <RouterLink to="/replenishments">查看补货流程 →</RouterLink>
          </div>
        </div>
        <div v-else-if="answer && !busy" class="answer-text">{{ answer }}</div>
        <div v-else-if="!busy" class="answer-empty">
          <img src="/lab-mark.svg" alt="" /><strong>从真实库存开始分析</strong>
          <p>生成可核对、可提交、可追踪的实验室物资补货草案。</p>
        </div>
      </Transition>
    </section>
  </div>
  <div
    v-if="confirmSku && selected"
    class="confirm-backdrop"
    @click.self="confirmSku = ''"
  >
    <div
      class="confirm-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <span class="overline">HUMAN APPROVAL GATE</span>
      <h2 id="confirm-title">确认提交补货申请</h2>
      <p>{{ selected.name }} · {{ selected.sku }}</p>
      <div class="confirm-quantity">
        {{ selected.quantity }} <small>{{ selected.unit }}</small>
      </div>
      <p>
        提交后进入主管审批，当前不会自动采购或入库。系统会再次校验库存与重复申请。
      </p>
      <div class="confirm-actions">
        <button type="button" class="text-button" @click="confirmSku = ''">
          取消
        </button>
        <button
          type="button"
          class="primary-button"
          :disabled="applying"
          @click="apply"
        >
          {{ applying ? "正在提交…" : "确认提交" }}
        </button>
      </div>
    </div>
  </div>
</template>
