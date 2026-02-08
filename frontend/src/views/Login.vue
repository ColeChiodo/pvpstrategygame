<template>
  <div class="login-page">
    <div class="parallax-container">
      <img
        src="/assets/global/bgs/clouds/Clouds_3/1.png"
        alt="Cloud layer 1"
        class="parallax-layer layer-1"
        :style="getLayerStyle(0.005)"
      />
      <img
        src="/assets/global/bgs/clouds/Clouds_3/2.png"
        alt="Cloud layer 2"
        class="parallax-layer layer-2"
        :style="getLayerStyle(0.01)"
      />
      <img
        src="/assets/global/bgs/clouds/Clouds_3/3.png"
        alt="Cloud layer 3"
        class="parallax-layer layer-3"
        :style="getLayerStyle(0.015)"
      />
      <img
        src="/assets/global/bgs/clouds/Clouds_3/4.png"
        alt="Cloud layer 4"
        class="parallax-layer layer-4"
        :style="getLayerStyle(0.02)"
      />

      <div class="login-content">
        <div class="login-card">
          <h1 class="login-title">Login</h1>

          <div class="oauth-buttons">
            <PlayButton 
              text="Continue with Google" 
              href="/api/auth/google" 
              color="google"
              icon="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
            />
            <PlayButton 
              text="Continue with Discord" 
              href="/api/auth/discord" 
              color="discord"
              icon="https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/discord.svg" 
            />
          </div>

          <a href="/" class="home-link">
            <img src="/assets/global/favicon.png" alt="Fortezza" class="home-logo" />
            Back to Home
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import PlayButton from "../components/PlayButton.vue";

const router = useRouter();
const authStore = useAuthStore();

const mouseX = ref(0);
const mouseY = ref(0);

const handleMouseMove = (e: MouseEvent) => {
  mouseX.value = e.clientX;
  mouseY.value = e.clientY;
};

onMounted(() => {
  if (authStore.isAuthenticated) {
    router.push("/play");
  }
  window.addEventListener("mousemove", handleMouseMove);
});

onUnmounted(() => {
  window.removeEventListener("mousemove", handleMouseMove);
});

const getLayerStyle = (factor: number) => {
  const x = (mouseX.value - window.innerWidth / 2) * factor;
  const y = (mouseY.value - window.innerHeight / 2) * factor;
  return {
    transform: `translate(-50%, -50%) translate(${x}px, ${y}px) scale(1.1)`,
  };
};
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  background-color: var(--color-primary);
  overflow: hidden;
}

.parallax-container {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

.parallax-layer {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 100%;
  height: 100%;
  object-fit: cover;
  image-rendering: pixelated;
}

.layer-1 {
  z-index: 1;
}

.layer-2 {
  z-index: 1;
}

.layer-3 {
  z-index: 1;
}

.layer-4 {
  z-index: 1;
}

.login-content {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.login-card {
  background-color: var(--color-secondary);
  padding: 2.5rem;
  width: 100%;
  max-width: 420px;
  border-radius: 1rem;
  border-bottom: 4px solid var(--color-primary);
  border-right: 4px solid var(--color-primary);
  text-align: center;
}

.login-title {
  color: white;
  font-size: 2rem;
  font-weight: bold;
  margin-bottom: 1.5rem;
}

.oauth-buttons {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.login-note {
  color: var(--color-gray-400);
  font-size: 0.875rem;
  margin-top: 1.5rem;
}

.home-link {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  color: var(--color-gray-400);
  font-size: 0.875rem;
  margin-top: 1rem;
  text-decoration: none;
  transition: color 0.2s;
}

.home-link:hover {
  color: white;
  text-decoration: underline;
}

.home-logo {
  width: 24px;
  height: 24px;
}
</style>
