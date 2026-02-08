<template>
  <div class="parallax-container" ref="containerRef">
    <img
      v-for="layer in layers"
      :key="layer.id"
      :id="layer.id"
      :ref="(el) => setLayerRef(el, layer.id)"
      :src="layer.src"
      class="parallax-layer"
      :style="{ zIndex: layer.zIndex }"
    />
    <div class="title-play-container">
      <slot name="content"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";

interface Layer {
  id: string;
  src: string;
  zIndex: number;
  initialOffsetY?: number;
}

const props = defineProps<{
  layers: Layer[];
}>();

const layerRefs = ref<Record<string, HTMLElement>>({});
const containerRef = ref<HTMLElement | null>(null);

function setLayerRef(el: any, id: string) {
  if (el) {
    layerRefs.value[id] = el as HTMLElement;
  }
}

let mouseX = 0;
let mouseY = 0;
let scrollYpos = 0;

function handleParallax() {
  scrollYpos = window.scrollY;
  updateTransforms();
}

function handleMouseMove(event: MouseEvent) {
  const centerX = window.innerWidth / 2;
  const centerY = window.innerHeight / 2;
  mouseX = (event.clientX - centerX) * 0.01;
  mouseY = (event.clientY - centerY) * 0.01;
  updateTransforms();
}

function updateTransforms() {
  const layers = props.layers;

  layers.forEach((layer, index) => {
    const el = layerRefs.value[layer.id];
    if (!el) return;

    const totalLayers = layers.length;
    const reversedIndex = totalLayers - 1 - index;

    const depth = (reversedIndex + 1) * 0.5;
    const scrollSpeed = (reversedIndex + 1) * 0.2;
    const offsetX = mouseX * depth;
    const offsetY = mouseY * depth;
    const scrollOffsetY = scrollYpos * scrollSpeed;
    const initialOffset = layer.initialOffsetY || 0;

    el.style.transform = `translate(${offsetX}px, ${scrollOffsetY + offsetY + initialOffset}px) scale(1.1)`;
  });
}

onMounted(() => {
  window.addEventListener("scroll", handleParallax);
  window.addEventListener("mousemove", handleMouseMove);
});

onUnmounted(() => {
  window.removeEventListener("scroll", handleParallax);
  window.removeEventListener("mousemove", handleMouseMove);
});
</script>

<style scoped>
.parallax-container {
  position: relative;
  width: 100%;
  min-height: 100vh;
  overflow: hidden;
}

.parallax-layer {
  position: absolute;
  top: -100px;
  left: 0;
  width: 100%;
  height: calc(100vh + 200px);
  object-fit: cover;
  image-rendering: pixelated;
  will-change: transform;
}

.title-play-container {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: white;
  z-index: 10;
}
</style>
