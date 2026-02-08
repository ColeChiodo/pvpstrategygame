<template>
  <div class="landing-page">
    <div class="parallax-wrapper">
      <Parallax :layers="parallaxLayers">
        <template #content>
          <img
            src="/assets/landing/title.png"
            alt="Game Title"
            class="game-title"
          />
          <PlayButton
            v-if="!authStore.isAuthenticated"
            text="PLAY NOW"
            to="/login"
            color="emerald"
          />
          <PlayButton v-else text="PLAY NOW" to="/play" color="emerald" />
        </template>
      </Parallax>

      <div class="transition-overlay">
        <img
          src="/assets/landing/0.png"
          alt="Transition"
          class="transition-image"
        />
      </div>
    </div>

    <div class="features-section">
      <div class="features-content">
        <FeatureCard
          title="Fortezza Tactics Online"
          description="...is a Turn Based Player-Versus-Player Strategy Tactics Game. Take control of several units to defeat your opponent."
          image="/assets/landing/action.png"
          imagePosition="right"
        />

        <FeatureCard
          title="Play Against Others"
          description="Match up against players from around the world, or create a private match for you and your friends."
          image="/assets/landing/fighting.png"
        />

        <FeatureCard
          title="Protect The King"
          description="Defend your King at all costs and hunt down your opponent's. Outsmart your rival and claim victory."
          image="/assets/landing/protect_the_king.png"
          imagePosition="right"
        />

        <h2 class="lead-army-title">Lead Your Army Today!</h2>

        <PlayButton
          v-if="!authStore.isAuthenticated"
          text="PLAY NOW"
          to="/login"
          color="emerald"
        />
        <PlayButton v-else text="PLAY NOW" to="/play" color="emerald" />
      </div>
    </div>

    <Footer />
  </div>
</template>

<script setup lang="ts">
import Parallax from "../components/Parallax.vue";
import Footer from "../components/Footer.vue";
import FeatureCard from "../components/FeatureCard.vue";
import PlayButton from "../components/PlayButton.vue";
import { useAuthStore } from "../stores/auth";

const authStore = useAuthStore();

const parallaxLayers = [
  { id: "5", src: "/assets/landing/5.png", zIndex: 1 },
  { id: "4", src: "/assets/landing/4.png", zIndex: 2 },
  { id: "3", src: "/assets/landing/3.png", zIndex: 3 },
  { id: "2", src: "/assets/landing/2.png", zIndex: 4 },
  { id: "1", src: "/assets/landing/1.png", zIndex: 5 },
];
</script>

<style scoped>
.landing-page {
  min-height: 100vh;
  background-color: var(--color-secondary);
  overflow-x: auto;
}

.parallax-wrapper {
  position: relative;
  width: 100%;
  min-height: 100vh;
}

.game-title {
  width: 500px;
  pointer-events: none;
  image-rendering: pixelated;
  margin-bottom: -1rem;
}

.transition-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  z-index: 10;
  pointer-events: none;
}

.transition-image {
  width: 100%;
  object-fit: cover;
  image-rendering: pixelated;
  display: block;
}

.features-section {
  position: relative;
  width: 100%;
  display: flex;
  justify-content: center;
  background-color: var(--color-primary);
  padding-bottom: 4rem;
}

.features-content {
  position: relative;
  z-index: 2;
  width: 100%;
  max-width: 1000px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.lead-army-title {
  color: white;
  font-size: 2rem;
  font-weight: bold;
  text-align: center;
  margin-top: 4rem;
  margin-bottom: 2rem;
}
</style>
