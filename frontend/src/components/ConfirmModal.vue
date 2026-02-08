<template>
  <Teleport to="body">
    <div v-if="isOpen" class="modal-overlay" @click.self="handleCancel">
      <div class="modal-container">
        <div class="modal-content">
          <h2 class="modal-title">{{ title }}</h2>
          <p class="modal-text">{{ message }}</p>

          <div v-if="itemInfo" class="item-info">
            <img v-if="itemImage" :src="itemImage" alt="" class="item-image" />
            <div class="item-details">
              <div class="item-name">{{ itemName }}</div>
              <div v-if="itemPrice" class="item-price">{{ itemPrice }} XP</div>
            </div>
          </div>

          <div class="modal-actions">
            <button @click="handleCancel" class="cancel-btn">
              Cancel
            </button>
            <button @click="handleConfirm" class="confirm-btn" :class="confirmClass">
              {{ confirmText }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";

const props = withDefaults(defineProps<{
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  confirmClass?: string;
  itemImage?: string;
  itemName?: string;
  itemPrice?: number | null;
}>(), {
  confirmText: "Confirm",
  confirmClass: "emerald",
});

const emit = defineEmits<{
  (e: "close"): void;
  (e: "confirm"): void;
}>();

watch(() => props.isOpen, (val) => {
  if (!val) {
    // Reset state if needed
  }
});

const handleCancel = () => {
  emit("close");
};

const handleConfirm = () => {
  emit("confirm");
  emit("close");
};
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-container {
  background-color: var(--color-secondary);
  border-radius: 1rem;
  border: 4px solid var(--color-primary);
  max-width: 400px;
  width: 90%;
  overflow: hidden;
}

.modal-content {
  padding: 2rem;
  text-align: center;
}

.modal-title {
  color: white;
  font-size: 1.5rem;
  font-weight: bold;
  margin-bottom: 1rem;
}

.modal-text {
  color: var(--color-gray-300);
  font-size: 1rem;
  line-height: 1.6;
  margin-bottom: 1.5rem;
}

.item-info {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background-color: var(--color-primary);
  border-radius: 0.5rem;
  margin-bottom: 1.5rem;
}

.item-image {
  width: 64px;
  height: 64px;
  image-rendering: pixelated;
  border-radius: 0.25rem;
}

.item-details {
  text-align: left;
}

.item-name {
  color: white;
  font-weight: bold;
  font-size: 1rem;
}

.item-price {
  color: var(--color-gold);
  font-size: 0.875rem;
  margin-top: 0.25rem;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.cancel-btn {
  padding: 0.875rem 2rem;
  background-color: var(--color-gray-600);
  color: white;
  font-weight: bold;
  border: none;
  border-bottom: 4px solid var(--color-gray-800);
  border-right: 4px solid var(--color-gray-800);
  border-radius: 0.5rem;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.1s;
}

.cancel-btn:hover {
  filter: brightness(1.1);
}

.cancel-btn:active {
  transform: translateY(2px);
  border-bottom-width: 2px;
  border-right-width: 2px;
}

.confirm-btn {
  padding: 0.875rem 2rem;
  font-weight: bold;
  border: none;
  border-bottom: 4px solid;
  border-right: 4px solid;
  border-radius: 0.5rem;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.1s;
  color: white;
}

.confirm-btn:hover {
  filter: brightness(1.1);
}

.confirm-btn:active {
  transform: translateY(2px);
  border-bottom-width: 2px;
  border-right-width: 2px;
}

.confirm-btn.emerald {
  background-color: var(--color-emerald-500);
  border-bottom-color: var(--color-emerald-700);
  border-right-color: var(--color-emerald-700);
}

.confirm-btn.amber {
  background-color: var(--color-amber-600);
  border-bottom-color: var(--color-amber-800);
  border-right-color: var(--color-amber-800);
}

.confirm-btn.rose {
  background-color: var(--color-rose-600);
  border-bottom-color: var(--color-rose-800);
  border-right-color: var(--color-rose-800);
}
</style>
