<template>
  <div class="app-container">
    <main class="app-main">
      <RouterView />
    </main>
    <TermsAcceptModal :is-open="showTermsModal" @close="handleTermsClose" />
    <AlertsModal />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { RouterView } from "vue-router";
import { useAuthStore } from "./stores/auth";
import { needsTermsAccept } from "./router";
import TermsAcceptModal from "./components/TermsAcceptModal.vue";
import AlertsModal from "./components/AlertsModal.vue";

const authStore = useAuthStore();
const showTermsModal = ref(false);

onMounted(async () => {
  await authStore.checkAuth();
});

watch(needsTermsAccept, (value) => {
  showTermsModal.value = value;
});

const handleTermsClose = () => {
  needsTermsAccept.value = false;
  showTermsModal.value = false;
};
</script>

<style>
.app-container {
  min-height: 100vh;
  background-color: var(--color-primary);
}

.app-main {
  min-height: 100vh;
}
</style>
