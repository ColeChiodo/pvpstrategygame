<template>
  <Teleport to="body">
    <div v-if="isOpen" class="modal-overlay">
      <div class="modal-container">
        <div class="modal-content">
          <h2 class="modal-title">Accept Terms of Service</h2>
          <p class="modal-text">
            Before you can play Fortezza Tactics Online, you must accept our
            <a href="/terms" target="_blank" class="terms-link">Terms of Service</a>.
          </p>
          
          <label class="checkbox-label">
            <input type="checkbox" v-model="accepted" />
            <span>I have read and agree to the Terms of Service</span>
          </label>

          <div class="modal-actions">
            <button 
              @click="handleAccept" 
              class="accept-btn" 
              :disabled="!accepted"
            >
              Accept & Play
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { RouterLink } from "vue-router";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
}>();

const router = useRouter();
const authStore = useAuthStore();
const accepted = ref(false);

watch(() => props.isOpen, (val) => {
  if (val) {
    accepted.value = false;
  }
});

const handleAccept = async () => {
  if (!accepted.value) return;
  
  try {
    const response = await fetch("/api/auth/accept-terms", {
      method: "POST",
      credentials: "include",
    });
    
    if (response.ok) {
      emit("close");
    }
  } catch (err) {
    console.error("Failed to accept terms:", err);
  }
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
  max-width: 480px;
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

.terms-link {
  color: var(--color-accent);
  text-decoration: underline;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: white;
  font-size: 0.95rem;
  cursor: pointer;
  margin-bottom: 1.5rem;
}

.checkbox-label input {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.modal-actions {
  display: flex;
  justify-content: center;
}

.accept-btn {
  background-color: var(--color-emerald-500);
  color: white;
  font-weight: bold;
  padding: 0.875rem 2rem;
  border-radius: 0.5rem;
  border: none;
  border-bottom: 4px solid var(--color-emerald-700);
  border-right: 4px solid var(--color-emerald-700);
  cursor: pointer;
  transition: all 0.1s;
  font-size: 1rem;
}

.accept-btn:hover:not(:disabled) {
  filter: brightness(1.1);
}

.accept-btn:active:not(:disabled) {
  transform: translateY(2px);
  border-bottom-width: 2px;
  border-right-width: 2px;
}

.accept-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
