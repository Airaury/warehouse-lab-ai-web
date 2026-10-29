<script setup>
import { onUnmounted, ref, watch } from "vue";

const props = defineProps({ value: { type: Number, default: 0 } });
const display = ref(0);
let frame = 0;
watch(() => props.value, (next) => {
  cancelAnimationFrame(frame);
  const target = Number(next) || 0;
  const start = display.value;
  const started = performance.now();
  const tick = (now) => {
    const t = Math.min(1, (now - started) / 620);
    const eased = 1 - Math.pow(1 - t, 3);
    display.value = Math.round(start + (target - start) * eased);
    if (t < 1) frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
}, { immediate: true });
onUnmounted(() => cancelAnimationFrame(frame));
</script>

<template><span class="rolling-number">{{ display.toLocaleString("zh-CN") }}</span></template>
