<template>
  <Teleport to="body">
    <TransitionGroup name="alert" tag="div" class="alerts-container">
      <div
        v-for="alert in alertsList"
        :key="alert.id"
        class="alert"
        :class="[`alert-${alert.type}`]"
      >
        <div class="alert-icon">
          <span v-if="alert.type === 'success'">✓</span>
          <span v-else-if="alert.type === 'error'">✕</span>
          <span v-else-if="alert.type === 'warning'">!</span>
          <span v-else>i</span>
        </div>
        <div class="alert-content">
          <div class="alert-message">{{ alert.message }}</div>
        </div>
        <button class="alert-close" @click="dismiss(alert.id)">×</button>
      </div>
    </TransitionGroup>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { getAlerts, dismissAlert } from "../composables/useAlerts";

const alertsList = computed(() => getAlerts());

const dismiss = (id: number) => {
  dismissAlert(id);
};
</script>

<style scoped>
.alerts-container {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-width: 400px;
  width: 100%;
  pointer-events: none;
}

.alert {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  border-radius: 0.5rem;
  border: 3px solid;
  pointer-events: auto;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.alert-success {
  background-color: rgba(16, 185, 129, 0.95);
  border-color: #059669;
}

.alert-error {
  background-color: rgba(244, 63, 94, 0.95);
  border-color: #be123c;
}

.alert-warning {
  background-color: rgba(245, 158, 11, 0.95);
  border-color: #b45309;
}

.alert-info {
  background-color: rgba(37, 99, 235, 0.95);
  border-color: #1d4ed8;
}

.alert-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background-color: rgba(0, 0, 0, 0.2);
  color: white;
  font-weight: bold;
  font-size: 0.875rem;
  flex-shrink: 0;
}

.alert-content {
  flex: 1;
}

.alert-message {
  color: white;
  font-size: 0.9375rem;
  font-weight: 500;
}

.alert-close {
  background: none;
  border: none;
  color: white;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  opacity: 0.7;
  transition: opacity 0.2s;
  flex-shrink: 0;
}

.alert-close:hover {
  opacity: 1;
}

.alert-enter-active {
  animation: alert-slide-in 0.3s ease-out;
}

.alert-leave-active {
  animation: alert-slide-out 0.3s ease-in;
}

@keyframes alert-slide-in {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes alert-slide-out {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(100%);
    opacity: 0;
  }
}
</style>
