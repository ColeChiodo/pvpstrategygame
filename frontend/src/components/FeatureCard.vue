<template>
  <div
    class="feature-card"
    :class="{ 'image-right': imagePosition === 'right' }"
  >
    <div v-if="image" class="feature-image">
      <img :src="image" :alt="title" />
    </div>
    <div class="feature-content">
      <h2 class="feature-title">{{ title }}</h2>
      <p class="feature-description">{{ description }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  description: string;
  image?: string;
  imagePosition?: "left" | "right";
}>();
</script>

<style scoped>
.feature-card {
  display: flex;
  flex-direction: column;
  margin-bottom: 3rem;
}

.feature-image {
  width: 100%;
  max-width: 1280px;
}

.feature-image img {
  width: 100%;
  height: auto;
  display: block;
  image-rendering: pixelated;
}

.feature-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1.5rem 0;
}

.feature-title {
  color: white;
  font-size: 2rem;
  font-weight: bold;
  margin-bottom: 1rem;
}

.feature-description {
  color: white;
  font-size: 1.125rem;
  line-height: 1.6;
  max-width: 1280px;
}

@media (min-width: 1024px) {
  .feature-card {
    flex-direction: row;
    align-items: center;
    max-width: 1000px;
  }

  .feature-card.image-right {
    flex-direction: row-reverse;
  }

  .feature-image {
    width: 50%;
    max-width: 450px;
  }

  .feature-content {
    width: 50%;
    align-items: flex-start;
    padding: 0 2rem;
  }

  .feature-title {
    font-size: 2.5rem;
  }

  .feature-card.image-right .feature-content {
    align-items: flex-end;
    text-align: right;
  }
}
</style>
