<script setup>
import { nextTick, onMounted, onUnmounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { request, state } from "../api.js";

const open = ref(false);
const draft = ref("");
const busy = ref(false);
const error = ref("");
const input = ref(null);
const list = ref(null);
const trigger = ref(null);
let nextId = 1;
const messages = ref([
  { id: 0, role: "assistant", content: "你好，我是仓灵。可以帮你核对库存风险、补货进度和近期出入库。你想先了解什么？", greeting: true },
]);
const examples = [
  "当前哪些物资需要关注？",
  "哪些补货申请正在进行？",
  "A区物资有什么风险？",
];

async function scrollToEnd() {
  await nextTick();
  list.value?.scrollTo({
    top: list.value.scrollHeight,
    behavior: "smooth",
  });
}
async function toggle() {
  open.value = !open.value;
  if (open.value) {
    await nextTick();
    input.value?.focus();
    scrollToEnd();
  } else trigger.value?.focus();
}
function close() {
  open.value = false;
  trigger.value?.focus();
}
function onKey(event) {
  if (event.key === "Escape" && open.value) close();
}
onMounted(() => window.addEventListener("keydown", onKey));
onUnmounted(() => window.removeEventListener("keydown", onKey));

async function send(text = draft.value) {
  const question = String(text || "").trim();
  if (!question || busy.value || !state.aiConfigured) return;
  if (question.length > 500) {
    error.value = "单次提问最多 500 字";
    return;
  }
  const history = messages.value
    .filter((entry) => !entry.greeting)
    .slice(-6)
    .map(({ role, content }) => ({ role, content: content.slice(0, 900) }));
  messages.value.push({ id: nextId++, role: "user", content: question });
  draft.value = "";
  error.value = "";
  busy.value = true;
  scrollToEnd();
  try {
    const result = await request("/api/ai/advice", {
      method: "POST",
      body: JSON.stringify({ question, history, compact: true }),
    });
    messages.value.push({ id: nextId++, role: "assistant", content: result.answer });
  } catch (err) {
    error.value = err.message;
  } finally {
    busy.value = false;
    scrollToEnd();
    await nextTick();
    input.value?.focus();
  }
}
</script>

<template>
  <div class="ai-companion">
    <Transition name="spirit-panel">
      <section v-if="open" id="warehouse-spirit-chat" class="spirit-chat" role="dialog" aria-modal="false" aria-label="与仓灵对话">
        <header class="spirit-chat-head">
          <div class="spirit-head-icon" aria-hidden="true"><img class="spirit-avatar" src="/warehouse-guide.png" alt="" /></div>
          <div class="spirit-head-copy">
            <span>WAREHOUSE AI / LIVE</span>
            <strong>仓灵 · 物资分析助手</strong>
            <small><i class="live-dot"></i>{{ state.aiConfigured ? "连接实时业务数据" : "等待 AI 服务配置" }}</small>
          </div>
          <button type="button" class="spirit-close" aria-label="关闭仓灵对话" @click="close">×</button>
        </header>
        <div ref="list" class="spirit-messages" aria-live="polite">
          <div v-for="entry in messages" :key="entry.id" class="spirit-message" :class="entry.role">
            <span v-if="entry.role === 'assistant'" class="spirit-message-mark" aria-hidden="true">✳</span>
            <p>{{ entry.content }}</p>
          </div>
          <div v-if="busy" class="spirit-message assistant" role="status">
            <span class="spirit-message-mark" aria-hidden="true">✳</span>
            <p class="spirit-thinking">正在核对实时数据<span></span><span></span><span></span></p>
          </div>
        </div>
        <div v-if="messages.length === 1" class="spirit-prompts" aria-label="快捷提问">
          <button v-for="example in examples" :key="example" type="button" :disabled="!state.aiConfigured || busy" @click="send(example)">{{ example }} <span>↗</span></button>
        </div>
        <div v-if="error" class="spirit-error" role="alert">{{ error }}</div>
        <form class="spirit-composer" @submit.prevent="send()">
          <label for="spirit-question" class="sr-only">向仓灵提问</label>
          <textarea id="spirit-question" ref="input" v-model="draft" rows="2" maxlength="500" :disabled="!state.aiConfigured || busy" placeholder="询问库存、补货、近期出入库…" @keydown.enter.exact.prevent="send()"></textarea>
          <button type="submit" class="spirit-send" :disabled="!draft.trim() || busy || !state.aiConfigured" aria-label="发送问题">↗</button>
        </form>
        <footer class="spirit-foot"><span>回答基于当前业务快照，须人工核对。</span><RouterLink to="/advisor" @click="close">打开决策台 →</RouterLink></footer>
      </section>
    </Transition>
    <button ref="trigger" type="button" class="spirit-launch" :aria-expanded="open" :aria-controls="open ? 'warehouse-spirit-chat' : undefined" :aria-label="open ? '收起仓灵对话' : '与仓灵对话'" @click="toggle">
      <span class="spirit-launch-orbit" aria-hidden="true"></span>
      <img class="spirit-avatar" src="/warehouse-guide.png" alt="" aria-hidden="true" />
      <span class="spirit-launch-label">{{ open ? "收起对话" : "问仓灵" }}</span>
    </button>
  </div>
</template>
