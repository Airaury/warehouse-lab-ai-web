<script setup>
import { ref } from "vue";
import { request, state, time } from "../api.js";
const question = ref(
  "请根据当前库存、近期出入库和进行中的补货单，按紧急程度给出补货建议。",
);
const answer = ref(""),
  snapshot = ref(""),
  error = ref(""),
  busy = ref(false);
const examples = [
  "哪些物资已低于安全阈值？列出 SKU 和缺口。",
  "现有补货单能否覆盖低库存风险？",
  "近期出库对库存有什么影响？",
];
async function ask() {
  answer.value = "";
  error.value = "";
  busy.value = true;
  try {
    const result = await request("/api/ai/advice", {
      method: "POST",
      body: JSON.stringify({ question: question.value.trim() }),
    });
    answer.value = result.answer;
    snapshot.value = result.snapshotAt;
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
      <span class="overline">AI ADVISOR</span>
      <h1>AI 决策台</h1>
      <p>仓储运营与补货分析师，依据实时业务数据回答。</p>
    </div>
  </div>
  <div class="advisor-layout">
    <section class="advisor-panel">
      <div class="advisor-ident">
        <span class="advisor-symbol">✳</span>
        <div>
          <span class="overline">WAREHOUSE ANALYST</span>
          <h2>仓储运营分析师</h2>
          <p>专业 · 简洁 · 数字有据</p>
        </div>
      </div>
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
      <label for="question" class="field-label">你的问题</label
      ><textarea
        id="question"
        v-model="question"
        maxlength="500"
        rows="5"
        placeholder="询问库存风险、补货优先级或审批影响…"
      ></textarea>
      <div class="advisor-submit">
        <span>{{ question.length }} / 500</span
        ><button
          class="primary-button"
          type="button"
          :disabled="busy || !state.aiConfigured || !question.trim()"
          @click="ask"
        >
          {{ busy ? "分析中…" : "生成建议" }} <span>↗</span>
        </button>
      </div>
      <p v-if="!state.aiConfigured" class="form-message error">
        AI 服务尚未配置
      </p>
      <p v-if="error" class="form-message error" role="alert">{{ error }}</p>
    </section>
    <section class="panel answer-panel">
      <div class="panel-head">
        <div>
          <span class="overline">ANALYSIS</span>
          <h2>分析结果</h2>
        </div>
        <span v-if="snapshot" class="snapshot">{{ time(snapshot) }}</span>
      </div>
      <div v-if="answer" class="answer-text">{{ answer }}</div>
      <div v-else class="answer-empty">
        <span>✳</span><strong>等待你的问题</strong>
        <p>分析师会结合库存、出入库、出库审批和补货单给出建议。</p>
      </div>
    </section>
  </div>
</template>
