<template>
  <div class="unit-info-panel" v-if="hoveredUnit || selectedUnit">
    <!-- Unit 1: Shows selected unit if selected, otherwise shows hovered unit -->
    <div class="unit-slot" :class="{ 'is-selected': selectedUnit }">
      <div class="unit-frame">
        <canvas ref="unit1Canvas" class="unit-canvas"></canvas>
      </div>
      <div class="unit-details">
        <div class="unit-name">
          {{ unit1Stats.name }}
          <span v-if="unit1Stats.name !== '---'" class="owner-indicator" :class="{ 'is-mine': unit1Stats.isMine, 'is-enemy': !unit1Stats.isMine }">
            {{ unit1Stats.isMine ? 'YOU' : 'ENEMY' }}
          </span>
        </div>
        <div class="unit-stats">
          <div class="stat health">
            <span class="stat-icon">♥</span>
            <span class="stat-value">{{ unit1Stats.health.toFixed(1) }}</span>
            <span class="stat-max">/ {{ unit1Stats.maxHealth.toFixed(1) }}</span>
          </div>
          <div class="stat attack">
            <span class="stat-icon">⚔</span>
            <span class="stat-value">{{ unit1Stats.attack }}</span>
          </div>
          <div class="stat defense">
            <span class="stat-icon">🛡</span>
            <span class="stat-value">{{ unit1Stats.defense }}</span>
          </div>
          <div class="stat mobility">
            <span class="stat-icon">👟</span>
            <span class="stat-value">{{ unit1Stats.mobility }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Interaction Arrow -->
    <div class="interaction-arrow" v-if="hoveredUnit && selectedUnit && isHoveringDifferentUnit">
      <span class="interaction-icon">{{ interactionIcon }}</span>
      <div class="interaction-text">{{ interactionText }}</div>
      <div class="interaction-amount" v-if="interactionAmount">{{ interactionAmount }}</div>
    </div>

    <!-- Unit 2: Target (hovered when unit is selected) -->
    <div class="unit-slot" :class="{ 'is-target': selectedUnit && hoveredUnit && isHoveringDifferentUnit && isEnemy, 'is-friendly': selectedUnit && hoveredUnit && isHoveringDifferentUnit && !isEnemy }" v-if="selectedUnit && hoveredUnit && isHoveringDifferentUnit">
      <div class="unit-frame">
        <canvas ref="unit2Canvas" class="unit-canvas"></canvas>
      </div>
      <div class="unit-details">
        <div class="unit-name">
          {{ hoveredUnit.name }}
          <span class="owner-indicator" :class="{ 'is-mine': isTargetMine, 'is-enemy': !isTargetMine }">
            {{ isTargetMine ? 'YOU' : 'ENEMY' }}
          </span>
        </div>
        <div class="unit-stats">
          <div class="stat health">
            <span class="stat-icon">♥</span>
            <span class="stat-value">{{ hoveredUnit.health.toFixed(1) }}</span>
            <span class="stat-max">/ {{ hoveredUnit.maxHealth.toFixed(1) }}</span>
          </div>
          <div class="stat attack">
            <span class="stat-icon">⚔</span>
            <span class="stat-value">{{ hoveredUnit.attack }}</span>
          </div>
          <div class="stat defense">
            <span class="stat-icon">🛡</span>
            <span class="stat-value">{{ hoveredUnit.defense }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from "vue";
import { Unit } from "../game-engine/types";
import { sprites } from "../game-engine/sprites";

const props = defineProps<{
  hoveredUnit: Unit | null;
  selectedUnit: Unit | null;
  players: any[];
  myPlayerIndex: number;
}>();

const unit1Canvas = ref<HTMLCanvasElement | null>(null);
const unit2Canvas = ref<HTMLCanvasElement | null>(null);
let animationFrameId: number | null = null;
let lastFrameTime = 0;

const isUnitSelected = computed(() => {
  if (!props.selectedUnit || !props.hoveredUnit) return false;
  return props.selectedUnit.id === props.hoveredUnit.id;
});

const isHoveringDifferentUnit = computed(() => {
  if (!props.selectedUnit || !props.hoveredUnit) return false;
  return props.selectedUnit.id !== props.hoveredUnit.id;
});

const isEnemy = computed(() => {
  if (!props.hoveredUnit || !props.selectedUnit) return false;
  const hoveredPlayer = props.players.find(p => p.units.some((u: Unit) => u.id === props.hoveredUnit!.id));
  const selectedPlayer = props.players.find(p => p.units.some((u: Unit) => u.id === props.selectedUnit!.id));
  return hoveredPlayer?.id !== selectedPlayer?.id;
});

// Check if hovered unit is mine (for visual indicator)
const isHoveredUnitMine = computed(() => {
  if (!props.hoveredUnit || props.myPlayerIndex < 0) return false;
  return props.players[props.myPlayerIndex]?.units.some((u: Unit) => u.id === props.hoveredUnit.id);
});

// Check if hovered unit (as target) is mine
const isTargetMine = computed(() => {
  if (!props.hoveredUnit || props.myPlayerIndex < 0) return false;
  return props.players[props.myPlayerIndex]?.units.some((u: Unit) => u.id === props.hoveredUnit.id);
});

// Unit 1 stats - shows selected unit, or hovered if no selection
const unit1Stats = computed(() => {
  const unit = props.selectedUnit || props.hoveredUnit;
  if (!unit) return { name: '---', health: 0, maxHealth: 0, attack: 0, defense: 0, mobility: 0, isMine: false };
  const isMine = props.selectedUnit 
    ? props.players[props.myPlayerIndex]?.units.some((u: Unit) => u.id === props.selectedUnit.id)
    : props.players[props.myPlayerIndex]?.units.some((u: Unit) => u.id === unit.id);
  return {
    name: unit.name,
    health: unit.health,
    maxHealth: unit.maxHealth,
    attack: unit.attack,
    defense: unit.defense,
    mobility: unit.mobilityRemaining ?? unit.mobility,
    isMine
  };
});

const interactionText = computed(() => {
  if (!props.selectedUnit || !props.hoveredUnit) return '';
  
  if (props.selectedUnit.id === props.hoveredUnit.id) {
    return 'Selected';
  }
  
  const range = props.selectedUnit.range;
  const distance = Math.abs(props.selectedUnit.row - props.hoveredUnit.row) + 
                  Math.abs(props.selectedUnit.col - props.hoveredUnit.col);
  
  if (distance > range + (props.selectedUnit.mobilityRemaining ?? props.selectedUnit.mobility)) {
    return 'Out of Range';
  }
  
  if (!props.selectedUnit.canAct) {
    return 'Action Used';
  }
  
  if (!isEnemy.value) {
    // Friendly unit - only healers can heal
    if (props.hoveredUnit.health >= props.hoveredUnit.maxHealth) {
      return 'Full Health';
    }
    if (props.selectedUnit.action !== 'heal') {
      return 'Not a Healer';
    }
    return distance <= range ? 'Heal' : 'Can Move & Heal';
  } else {
    // Enemy unit
    return distance <= range ? 'Attack' : 'Can Move & Attack';
  }
});

const interactionIcon = computed(() => {
  if (!props.selectedUnit || !props.hoveredUnit || props.selectedUnit.id === props.hoveredUnit.id) return '→';
  
  if (interactionText.value === 'Out of Range' || interactionText.value === 'Action Used' || interactionText.value === 'Full Health') {
    return '⊘';
  }
  
  if (interactionText.value === 'Heal' || interactionText.value === 'Can Move & Heal') {
    return '💚';
  }
  
  return '⚔';
});

const interactionAmount = computed(() => {
  if (!props.selectedUnit || !props.hoveredUnit) return null;
  if (props.selectedUnit.id === props.hoveredUnit.id) return null;
  
  const range = props.selectedUnit.range;
  const distance = Math.abs(props.selectedUnit.row - props.hoveredUnit.row) + 
                  Math.abs(props.selectedUnit.col - props.hoveredUnit.col);
  
  if (distance > range + (props.selectedUnit.mobilityRemaining ?? props.selectedUnit.mobility)) {
    return null;
  }
  
  if (!props.selectedUnit.canAct) return null;
  
  if (!isEnemy.value) {
    if (props.hoveredUnit.health >= props.hoveredUnit.maxHealth) return null;
    const healAmount = props.selectedUnit.attack;
    return `+${healAmount.toFixed(1)}`;
  } else {
    const damage = props.selectedUnit.attack * (1 - props.hoveredUnit.defense / (props.hoveredUnit.defense + 20));
    return `-${damage.toFixed(1)}`;
  }
});

// Cache for spritesheet images
const imageCache: Record<string, HTMLImageElement> = {};

function drawUnitSprite(canvas: HTMLCanvasElement | null, unit: Unit | null, isAnimating = true) {
  if (!canvas || !unit) return;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  const spriteDef = sprites.find(s => s.name === unit.name);
  if (!spriteDef) return;
  
  // Get or load spritesheet image
  let img = imageCache[unit.name];
  if (!img) {
    img = new Image();
    img.src = `/assets/spritesheets/${unit.name}.png`;
    img.onload = () => {
      imageCache[unit.name] = img!;
    };
  }
  
  if (!img.complete) return; // Wait for image to load
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Calculate frame
  let frameX = 0;
  let frameY = 0;
  
  if (isAnimating) {
    const now = Date.now();
    const frameDuration = spriteDef.framesHold || 50;
    const elapsed = now % (spriteDef.idleFrames * frameDuration);
    frameX = Math.floor(elapsed / frameDuration) % spriteDef.idleFrames;
    frameY = 0; // Idle row
  }
  
  const spriteWidth = 32;
  const spriteHeight = 32;
  const drawSize = 48;
  
  // Direction flip
  const direction = unit.sprite?.direction || 1;
  
  ctx.save();
  if (direction === -1) {
    ctx.translate(drawSize, 0);
    ctx.scale(-1, 1);
  }
  
  // Center sprite in canvas (32x32 sprite in 48x48 canvas)
  const offsetX = (48 - 32) / 2;
  const offsetY = (48 - 32) / 2;
  
  ctx.drawImage(
    img,
    frameX * spriteWidth, frameY * spriteHeight, spriteWidth, spriteHeight,
    offsetX, offsetY, drawSize, drawSize
  );
  
  ctx.restore();
}

function startAnimation() {
  const animate = () => {
    const unit1 = props.selectedUnit || props.hoveredUnit;
    drawUnitSprite(unit1Canvas.value, unit1);
    drawUnitSprite(unit2Canvas.value, props.hoveredUnit);
    animationFrameId = requestAnimationFrame(animate);
  };
  animate();
}

function stopAnimation() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

onMounted(() => {
  nextTick(() => {
    if (unit1Canvas.value) {
      unit1Canvas.value.width = 48;
      unit1Canvas.value.height = 48;
    }
    if (unit2Canvas.value) {
      unit2Canvas.value.width = 48;
      unit2Canvas.value.height = 48;
    }
    startAnimation();
  });
});

onUnmounted(() => {
  stopAnimation();
});

watch(() => props.hoveredUnit, () => {
  const unit1 = props.selectedUnit || props.hoveredUnit;
  drawUnitSprite(unit1Canvas.value, unit1);
  drawUnitSprite(unit2Canvas.value, props.hoveredUnit);
});

watch(() => props.selectedUnit, () => {
  const unit1 = props.selectedUnit || props.hoveredUnit;
  drawUnitSprite(unit1Canvas.value, unit1);
});
</script>

<style scoped>
.unit-info-panel {
  position: fixed;
  bottom: 20px;
  left: 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(0, 0, 0, 0.85);
  border: 2px solid #3a3a5a;
  border-radius: 8px;
  padding: 12px;
  color: #fff;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  z-index: 1000;
}

.unit-slot {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 6px;
  background: rgba(30, 30, 50, 0.8);
  border: 2px solid transparent;
  transition: all 0.2s ease;
}

.unit-slot.is-selected {
  border-color: #4fc3f7;
  background: rgba(30, 60, 80, 0.9);
}

.unit-slot.is-target {
  border-color: #ef5350;
  background: rgba(80, 30, 30, 0.9);
}

.unit-slot.is-friendly {
  border-color: #66bb6a;
  background: rgba(30, 60, 40, 0.9);
}

.unit-frame {
  width: 48px;
  height: 48px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 4px;
  overflow: visible;
  display: flex;
  align-items: center;
  justify-content: center;
}

.unit-canvas {
  width: 48px;
  height: 48px;
  image-rendering: pixelated;
}

.unit-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 80px;
}

.unit-name {
  font-size: 12px;
  font-weight: bold;
  text-transform: capitalize;
  color: #fff;
  display: flex;
  align-items: center;
  gap: 4px;
}

.owner-indicator {
  font-size: 8px;
  padding: 1px 4px;
  border-radius: 3px;
  font-weight: bold;
}

.owner-indicator.is-mine {
  background: rgba(102, 187, 106, 0.3);
  color: #66bb6a;
  border: 1px solid #66bb6a;
}

.owner-indicator.is-enemy {
  background: rgba(239, 83, 80, 0.3);
  color: #ef5350;
  border: 1px solid #ef5350;
}

.unit-stats {
  display: flex;
  gap: 8px;
  font-size: 10px;
}

.stat {
  display: flex;
  align-items: center;
  gap: 2px;
}

.stat-icon {
  font-size: 10px;
  opacity: 0.7;
}

.stat-value {
  font-weight: bold;
  color: #fff;
}

.stat-max {
  color: #888;
  font-size: 9px;
}

.stat.health .stat-value { color: #ef5350; }
.stat.attack .stat-value { color: #ff9800; }
.stat.defense .stat-value { color: #4fc3f7; }
.stat.mobility .stat-value { color: #66bb6a; }

.interaction-arrow {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
}

.interaction-icon {
  font-size: 24px;
  color: #fff;
}

.interaction-text {
  font-size: 10px;
  color: #aaa;
  text-align: center;
  white-space: nowrap;
}

.interaction-amount {
  font-size: 14px;
  font-weight: bold;
  color: #fff;
}
</style>
