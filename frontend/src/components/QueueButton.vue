<template>
  <button
    type="button"
    class="play-button queue-button"
    :class="{ 'in-queue': isInQueue }"
    @click="handleClick"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <img v-if="icon && !isInQueue" :src="icon" alt="" class="button-icon" />
    <span v-if="isInQueue && !isHovered" class="queue-time">{{ formattedTime }}</span>
    <span v-else-if="isInQueue && isHovered">Cancel</span>
    <span v-else>{{ text }}</span>
  </button>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";

const props = defineProps<{
  text: string;
  isInQueue: boolean;
  queueTime: number;
  icon?: string;
}>();

const emit = defineEmits<{
  click: [];
  cancel: [];
}>();

const isHovered = ref(false);

const formattedTime = computed(() => {
  const mins = Math.floor(props.queueTime / 60);
  const secs = props.queueTime % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
});

const handleClick = () => {
  if (props.isInQueue) {
    emit("cancel");
  } else {
    emit("click");
  }
};
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
  min-width: 140px;
}

.play-button:hover {
  filter: brightness(1.1);
}

.play-button:active {
  transform: translateY(2px);
  border-bottom-width: 2px;
  border-right-width: 2px;
}

.play-button {
  background-color: var(--color-cyan-600);
  border-bottom-color: var(--color-cyan-800);
  border-right-color: var(--color-cyan-800);
}

.play-button.in-queue {
  background-color: var(--color-rose-600);
  border-bottom-color: var(--color-rose-800);
  border-right-color: var(--color-rose-800);
}

.queue-button {
  position: relative;
}

.queue-time {
  font-family: monospace;
  font-size: 1.1rem;
}

.button-icon {
  width: 20px;
  height: 20px;
}
</style>
