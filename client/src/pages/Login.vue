<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { request, state } from "../api.js";
const route = useRoute(),
  router = useRouter();
const username = ref(""),
  password = ref(""),
  busy = ref(false),
  error = ref(""),
  showRecovery = ref(false);
const stages = [
  {
    number: "01",
    title: "库存预警",
    description: "实时库存对照安全阈值，缺口出现时立即进入待办。",
    signal: "发现缺口",
  },
  {
    number: "02",
    title: "AI 核对",
    description: "分析师调用只读工具核对库存、出入库与进行中补货。",
    signal: "证据可查",
  },
  {
    number: "03",
    title: "人工审批",
    description: "补货建议由人确认，主管或副主管审批后继续流转。",
    signal: "责任清晰",
  },
  {
    number: "04",
    title: "收货回写",
    description: "仓管员确认收货，库存、消息和统计同步更新。",
    signal: "闭环完成",
  },
];
const activeStage = ref(0);
const currentStage = computed(() => stages[activeStage.value]);
let stageTimer;
function startStory() {
  clearInterval(stageTimer);
  stageTimer = setInterval(() => {
    if (!document.hidden)
      activeStage.value = (activeStage.value + 1) % stages.length;
  }, 4600);
}
function chooseStage(index) {
  activeStage.value = index;
  startStory();
}
onMounted(startStory);
onUnmounted(() => clearInterval(stageTimer));
async function login() {
  busy.value = true;
  error.value = "";
  try {
    state.user = (
      await request("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username: username.value,
          password: password.value,
        }),
      })
    ).user;
    password.value = "";
    router.replace(
      typeof route.query.redirect === "string" &&
        route.query.redirect.startsWith("/")
        ? route.query.redirect
        : "/",
    );
  } catch (err) {
    error.value = err.message;
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <div class="login-page">
    <div class="login-art">
      <div class="login-ambient" aria-hidden="true">
        <i class="ambient-ring ring-a"></i><i class="ambient-ring ring-b"></i
        ><i class="ambient-ring ring-c"></i><i class="ambient-beam"></i>
      </div>
      <div class="login-brand">
        <img
          class="brand-mark"
          src="/lab-mark.svg"
          alt=""
          aria-hidden="true"
        /><strong>仓序 LAB</strong>
      </div>
      <div class="login-hero">
        <span class="overline">LAB MATERIAL INTELLIGENCE</span>
        <h1>让实验不停在<br />缺料之前。</h1>
        <p>让实时库存、AI 风险草案和人工审批连成一条可追踪的物资决策线。</p>
      </div>
      <div class="login-story" aria-label="仓序业务流程介绍">
        <div class="story-heading">
          <span class="overline">ONE CONNECTED WORKFLOW</span>
          <span>四步完成物资闭环</span>
        </div>
        <div class="story-steps" role="group" aria-label="选择业务流程步骤">
          <button
            v-for="(stage, index) in stages"
            :key="stage.number"
            type="button"
            class="story-step"
            :class="{ active: activeStage === index }"
            :aria-pressed="activeStage === index"
            @click="chooseStage(index)"
          >
            <span>{{ stage.number }}</span
            ><strong>{{ stage.title }}</strong>
          </button>
        </div>
        <div class="story-display">
          <span class="story-node" aria-hidden="true"
            ><img src="/lab-mark.svg" alt=""
          /></span>
          <Transition name="story-swap" mode="out-in">
            <div :key="currentStage.number" class="story-copy">
              <span
                >{{ currentStage.signal }} · {{ currentStage.number }}/04</span
              >
              <strong>{{ currentStage.title }}</strong>
              <p>{{ currentStage.description }}</p>
            </div>
          </Transition>
        </div>
      </div>
    </div>
    <div class="login-form-wrap">
      <form class="login-card" @submit.prevent="login">
        <span class="overline">WELCOME BACK</span>
        <h2>登录工作台</h2>
        <p>使用已分配的实验室物资账号继续。</p>
        <label
          >账号<input
            v-model="username"
            autofocus
            autocomplete="username"
            required
            placeholder="输入账号" /></label
        ><label
          >密码<input
            v-model="password"
            type="password"
            autocomplete="current-password"
            required
            placeholder="输入密码"
        /></label>
        <button
          type="button"
          class="forgot-link"
          @click="showRecovery = !showRecovery"
        >
          忘记密码？
        </button>
        <p v-if="showRecovery" class="recovery-note">
          请联系主管或董事长在“账号管理”中重置密码。若管理账号无法登录，请按项目 README
          的本机恢复流程操作。
        </p>
        <p v-if="error" class="form-message error" role="alert">{{ error }}</p>
        <button class="primary-button full scan-action" :disabled="busy">
          {{ busy ? "正在登录…" : "登录仓序" }} <span>→</span>
        </button>
        <div class="login-roles">
          <span>董事长 · 全局管理</span><span>主管 · 账号与审批</span
          ><span>副主管 · 业务审批</span><span>仓管员 · 日常出入库</span><span>观察员 · 数据查看</span>
        </div>
      </form>
    </div>
  </div>
</template>
