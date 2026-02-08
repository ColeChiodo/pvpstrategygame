<template>
  <div class="page-header">
    <RouterLink to="/" class="logo-link">
      <img
        src="/assets/landing/title.png"
        alt="Fortezza Tactics"
        class="logo"
      />
    </RouterLink>
  </div>
</template>

<script setup lang="ts">
import { RouterLink } from "vue-router";
</script>

<style scoped>
.page-header {
  background-color: var(--color-secondary);
  width: 100%;
  padding: 1rem 0;
  display: flex;
  justify-content: center;
  border-bottom: 4px solid rgba(0, 0, 0, 0.2);
}

.logo-link {
  display: inline-block;
}

.logo {
  width: 200px;
  height: auto;
  image-rendering: pixelated;
}

.logo-link:hover {
  opacity: 0.9;
}
</style>
