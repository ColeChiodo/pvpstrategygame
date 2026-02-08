<template>
  <nav class="navbar bg-primary text-primary-content">
    <div class="container mx-auto flex justify-between items-center p-4">
      <RouterLink to="/" class="btn btn-ghost text-xl font-pixel">
        Fortezza Tactics
      </RouterLink>

      <div class="flex gap-2">
        <template v-if="authStore.isAuthenticated">
          <div class="flex items-center gap-2 mr-4">
            <img
              v-if="authStore.user?.avatarUrl"
              :src="authStore.user.avatarUrl"
              class="avatar"
            />
            <span class="text-sm">{{ authStore.user?.username }}</span>
            <span class="badge badge-accent">{{
              authStore.user?.rank?.tier
            }}</span>
          </div>
          <button @click="handleLogout" class="btn btn-sm btn-secondary">
            Logout
          </button>
        </template>
        <template v-else>
          <RouterLink to="/login" class="btn btn-primary"> Login </RouterLink>
        </template>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { useAuthStore } from "../stores/auth";

const authStore = useAuthStore();

async function handleLogout() {
  await authStore.logout();
}
</script>
