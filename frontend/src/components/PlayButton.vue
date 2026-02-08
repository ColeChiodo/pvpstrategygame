<template>
  <a v-if="href" :href="href" class="play-button" :class="colorClass">
    <img v-if="icon" :src="icon" alt="" class="button-icon" />
    {{ text }}
  </a>
  <RouterLink v-else-if="to" :to="to" class="play-button" :class="colorClass">
    <img v-if="icon" :src="icon" alt="" class="button-icon" />
    {{ text }}
  </RouterLink>
  <button v-else :class="colorClass" class="play-button">
    <img v-if="icon" :src="icon" alt="" class="button-icon" />
    {{ text }}
  </button>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";

const props = defineProps<{
  text: string;
  href?: string;
  to?: string;
  icon?: string;
  color?: "emerald" | "cyan" | "amber" | "rose" | "gray" | "google" | "discord";
}>();

const colorClass = computed(() => `play-button-${props.color || "emerald"}`);
</script>

<style scoped>
.play-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.875rem 1.5rem;
  border-radius: 0.5rem;
  color: white;
  font-weight: bold;
  border-top: 2px solid rgba(255, 255, 255, 0.3);
  border-left: 2px solid rgba(255, 255, 255, 0.3);
  border-bottom: 4px solid;
  border-right: 4px solid;
  text-decoration: none;
  transition: all 0.1s;
  cursor: pointer;
  font-family: inherit;
  font-size: inherit;
}

.play-button:hover {
  filter: brightness(1.1);
}

.play-button:active {
  transform: translateY(2px);
  border-bottom-width: 2px;
  border-right-width: 2px;
}

.button-icon {
  width: 20px;
  height: 20px;
}

:global(.play-button-discord .button-icon) {
  filter: brightness(0) invert(1);
}

.play-button-emerald {
  background-color: var(--color-emerald-500);
  border-bottom-color: var(--color-emerald-700);
  border-right-color: var(--color-emerald-700);
}

.play-button-cyan {
  background-color: var(--color-cyan-600);
  border-bottom-color: var(--color-cyan-800);
  border-right-color: var(--color-cyan-800);
}

.play-button-amber {
  background-color: var(--color-amber-600);
  border-bottom-color: var(--color-amber-800);
  border-right-color: var(--color-amber-800);
}

.play-button-rose {
  background-color: var(--color-rose-600);
  border-bottom-color: var(--color-rose-800);
  border-right-color: var(--color-rose-800);
}

.play-button-gray {
  background-color: var(--color-gray-500);
  border-bottom-color: var(--color-gray-700);
  border-right-color: var(--color-gray-700);
}

.play-button-google {
  background-color: #1a73e8;
  border-bottom-color: #1557b0;
  border-right-color: #1557b0;
}

.play-button-discord {
  background-color: #5865f2;
  border-bottom-color: #4049ab;
  border-right-color: #4049ab;
}
</style>
