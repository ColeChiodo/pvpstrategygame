<template>
  <div class="bg-secondary text-md flex flex-col items-center justify-start min-h-screen overflow-x-auto">

    <!-- Hero Section with Parallax -->
    <div id="main" class="bg-secondary w-screen h-screen flex items-center justify-center overflow-hidden relative">
      <div id="paralaxed" class="relative w-full h-screen overflow-hidden">
        <img v-for="n in 5" :key="n" :src="`/assets/landing/${n}.png`"
             class="parallax-layer absolute top-0 left-0 h-screen xl:w-screen xl:h-auto object-cover"
             style="image-rendering: pixelated; z-index: 1;"
        />

        <div id="titleAndPlay" class="absolute inset-0 flex flex-col items-center justify-center text-center text-white z-10">
          <img src="/assets/landing/title.png" alt="Game Title" class="w-[500px] pointer-events-none" style="image-rendering: pixelated;">
          <router-link to="/home" class="-my-4 px-6 py-3 rounded-lg bg-emerald-500 text-white font-bold border-b-4 border-r-4 border-emerald-700 transition hover:bg-emerald-600">
            PLAY NOW
          </router-link>
        </div>
      </div>
    </div>

    <!-- Middle Sections -->
    <div class="bg-primary w-screen flex justify-center relative">
      <div class="bg-primary w-screen lg:w-1/2 flex flex-col justify-center p-6 relative">

        <!-- Background image -->
        <img id="0" src="/assets/landing/0.png"
             class="absolute top-0 md:top-auto md:bottom-0 left-0 h-screen xl:w-screen xl:h-auto object-cover"
             style="image-rendering: pixelated; z-index: 1;"
             data-speed="0.6"
        />

        <!-- Section 1 -->
        <div class="flex flex-col lg:flex-row my-6 relative z-10">
          <div class="flex flex-col justify-center">
            <p class="text-white text-4xl font-bold">Fortezza Tactics Online</p>
            <p class="text-white mb-4">
              ...is a Turn Based Player-Versus-Player Strategy Tactics Game. Take control of several units to defeat your opponent.
            </p>
          </div>
          <img src="/assets/landing/action.png" alt="Example Game Scene" class="object-cover w-full" style="image-rendering: pixelated;">
        </div>

        <!-- Section 2 -->
        <div class="flex flex-col lg:flex-row my-6 relative z-10">
          <img src="/assets/landing/fighting.png" alt="Example Game Scene" class="object-cover w-full" style="image-rendering: pixelated;">
          <div class="flex flex-col justify-center ml-4">
            <p class="text-white text-4xl font-bold mt-4">Play Against Others</p>
            <p class="text-white mb-4">
              Match up against players from around the world, or create a private match for you and your friends.
            </p>
          </div>
        </div>

        <!-- Section 3 -->
        <div class="flex flex-col lg:flex-row my-6 relative z-10">
          <div class="flex flex-col justify-center">
            <p class="text-white text-4xl font-bold">Protect The King</p>
            <p class="text-white mb-4">
              Defend your King at all costs and hunt down your opponent's. Outsmart your rival and claim victory.
            </p>
          </div>
          <img src="/assets/landing/protect_the_king.png" alt="Example Game Scene" class="object-cover w-full" style="image-rendering: pixelated;">
        </div>

        <!-- Call to Action -->
        <p class="text-white text-4xl font-bold text-center my-6 relative z-10">Lead Your Army Today!</p>
        <div class="flex items-center justify-center my-4 relative z-10">
          <router-link to="/home" class="px-6 py-3 rounded-lg bg-emerald-500 text-white font-bold border-b-4 border-r-4 border-emerald-700 transition hover:bg-emerald-600">
            PLAY NOW
          </router-link>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <footer class="bg-gray-900 text-white w-full text-center py-6">
      <p>&copy; 2026 Fortezza Tactics Online. All Rights Reserved.</p>
    </footer>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'

// Parallax effect for hero section
onMounted(() => {
  const layers = document.querySelectorAll('.parallax-layer');
  window.addEventListener('scroll', () => {
    const top = window.pageYOffset;
    layers.forEach((layer, index) => {
      const speed = (index + 1) * 0.2;
      layer.style.transform = `translateY(${top * speed}px)`;
    });
  });
})
</script>

<style scoped>
/* Optional global styles */
body {
  margin: 0;
  font-family: 'Inter', sans-serif;
}

.parallax-layer {
  transition: transform 0.1s linear;
}
</style>

