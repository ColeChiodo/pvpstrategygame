<template>
  <Teleport to="body">
    <div v-if="isOpen" class="modal-overlay" @click.self="handleClose">
      <div class="modal-container">
        <div class="modal-content">
          <h2 class="modal-title" :class="isWinner ? 'win' : 'loss'">
            {{ isWinner ? 'Victory!' : 'Defeat' }}
          </h2>
          
          <div class="win-reason" v-if="reason">
            {{ formatReason(reason) }}
          </div>

          <div class="xp-section">
            <div class="xp-bar-container">
              <div class="xp-bar-label">XP Progress</div>
              <div class="xp-bar-track">
                <div 
                  class="xp-bar-fill" 
                  :style="{ width: `${xpProgressBefore}%` }"
                ></div>
                <div 
                  class="xp-bar-fill xp-gaining" 
                  :style="{ width: `${xpGainPercent}%`, left: `${xpProgressBefore}%` }"
                  :class="{ animate: showXpAnimation }"
                ></div>
              </div>
              <div class="xp-bar-values">
                <span>{{ currentXP }}</span>
                <span class="xp-gain-text" v-if="xpGained > 0">+{{ xpGained }} XP</span>
                <span>{{ xpForNextLevel }}</span>
              </div>
            </div>
            <div v-if="leveledUp" class="level-up">
              Level Up! +{{ currencyGained }} Gold
            </div>
          </div>

          <div class="stats-section">
            <h3 class="stats-title">Your Stats</h3>
            <div class="stats-grid">
              <div class="stat-item">
                <span class="stat-value">{{ Math.round(stats.damageDealt) }}</span>
                <span class="stat-label">Damage Dealt</span>
              </div>
              <div class="stat-item">
                <span class="stat-value">{{ Math.round(stats.damageHealed) }}</span>
                <span class="stat-label">Healing Done</span>
              </div>
              <div class="stat-item">
                <span class="stat-value">{{ stats.unitsKilled }}</span>
                <span class="stat-label">Units Killed</span>
              </div>
              <div class="stat-item">
                <span class="stat-value">{{ stats.unitsLost }}</span>
                <span class="stat-label">Units Lost</span>
              </div>
              <div class="stat-item">
                <span class="stat-value">{{ stats.rounds || 0 }}</span>
                <span class="stat-label">Rounds</span>
              </div>
              <div class="stat-item">
                <span class="stat-value">{{ formatDuration(stats.duration) }}</span>
                <span class="stat-label">Duration</span>
              </div>
              <div class="stat-item">
                <span class="stat-value">{{ stats.attacksMade || 0 }}</span>
                <span class="stat-label">Attacks</span>
              </div>
              <div class="stat-item">
                <span class="stat-value">{{ stats.avgDamagePerAttack?.toFixed(1) || 0 }}</span>
                <span class="stat-label">Avg Dmg/Attack</span>
              </div>
              <div class="stat-item">
                <span class="stat-value">{{ stats.remainingKingHealth || 0 }}</span>
                <span class="stat-label">King HP Left</span>
              </div>
            </div>
          </div>

          <div class="stats-section" v-if="mvpUnit">
            <h3 class="stats-title">MVP Unit: {{ formatUnitName(mvpUnit.type) }}</h3>
            <div class="stats-grid">
              <div class="stat-item">
                <span class="stat-value">{{ mvpUnit.kills }}</span>
                <span class="stat-label">Kills</span>
              </div>
              <div class="stat-item">
                <span class="stat-value">{{ Math.round(mvpUnit.damage) }}</span>
                <span class="stat-label">Damage</span>
              </div>
              <div class="stat-item" v-if="mvpUnit.healing > 0">
                <span class="stat-value">{{ Math.round(mvpUnit.healing) }}</span>
                <span class="stat-label">Healing</span>
              </div>
            </div>
          </div>

          <div class="stats-section" v-if="hasUnitStats">
            <h3 class="stats-title">Unit Performance</h3>
            <div class="stats-grid">
              <div class="stat-item" v-if="stats.meleeKilled">
                <span class="stat-value">{{ stats.meleeKilled }}</span>
                <span class="stat-label">Melee Kills</span>
              </div>
              <div class="stat-item" v-if="stats.rangedKilled">
                <span class="stat-value">{{ stats.rangedKilled }}</span>
                <span class="stat-label">Ranged Kills</span>
              </div>
              <div class="stat-item" v-if="stats.mageKilled">
                <span class="stat-value">{{ stats.mageKilled }}</span>
                <span class="stat-label">Mage Kills</span>
              </div>
              <div class="stat-item" v-if="stats.healerKilled">
                <span class="stat-value">{{ stats.healerKilled }}</span>
                <span class="stat-label">Healer Kills</span>
              </div>
              <div class="stat-item" v-if="stats.cavalryKilled">
                <span class="stat-value">{{ stats.cavalryKilled }}</span>
                <span class="stat-label">Cavalry Kills</span>
              </div>
              <div class="stat-item" v-if="stats.scoutKilled">
                <span class="stat-value">{{ stats.scoutKilled }}</span>
                <span class="stat-label">Scout Kills</span>
              </div>
              <div class="stat-item" v-if="stats.tankKilled">
                <span class="stat-value">{{ stats.tankKilled }}</span>
                <span class="stat-label">Tank Kills</span>
              </div>
              <div class="stat-item" v-if="stats.kingKilled">
                <span class="stat-value">{{ stats.kingKilled }}</span>
                <span class="stat-label">King Kills</span>
              </div>
              <div class="stat-item" v-if="stats.meleeLost">
                <span class="stat-value loss">{{ stats.meleeLost }}</span>
                <span class="stat-label">Melee Lost</span>
              </div>
              <div class="stat-item" v-if="stats.rangedLost">
                <span class="stat-value loss">{{ stats.rangedLost }}</span>
                <span class="stat-label">Ranged Lost</span>
              </div>
              <div class="stat-item" v-if="stats.mageLost">
                <span class="stat-value loss">{{ stats.mageLost }}</span>
                <span class="stat-label">Mage Lost</span>
              </div>
              <div class="stat-item" v-if="stats.tankLost">
                <span class="stat-value loss">{{ stats.tankLost }}</span>
                <span class="stat-label">Tank Lost</span>
              </div>
            </div>
          </div>

          <div class="modal-actions">
            <button @click="handleClose" class="close-btn">
              Return to Lobby
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";

interface PlayerStats {
  unitsKilled: number;
  damageDealt: number;
  damageHealed: number;
  unitsLost: number;
  rounds?: number;
  duration?: number;
  timeUsed?: number;
  attacksMade?: number;
  killsLanded?: number;
  avgDamagePerAttack?: number;
  remainingKingHealth?: number;
  meleeDamage?: number;
  rangedDamage?: number;
  mageDamage?: number;
  healerDamage?: number;
  cavalryDamage?: number;
  scoutDamage?: number;
  tankDamage?: number;
  kingDamage?: number;
  meleeHealing?: number;
  rangedHealing?: number;
  mageHealing?: number;
  healerHealing?: number;
  cavalryHealing?: number;
  scoutHealing?: number;
  tankHealing?: number;
  kingHealing?: number;
  meleeKilled?: number;
  rangedKilled?: number;
  mageKilled?: number;
  healerKilled?: number;
  cavalryKilled?: number;
  scoutKilled?: number;
  tankKilled?: number;
  kingKilled?: number;
  meleeLost?: number;
  rangedLost?: number;
  mageLost?: number;
  healerLost?: number;
  cavalryLost?: number;
  scoutLost?: number;
  tankLost?: number;
  kingLost?: number;
}

const props = withDefaults(defineProps<{
  isOpen: boolean;
  isWinner: boolean;
  reason?: string;
  stats: PlayerStats;
  xpGained?: number;
  leveledUp?: boolean;
  currencyGained?: number;
  currentXP?: number;
  xpForNextLevel?: number;
}>(), {
  xpGained: 0,
  leveledUp: false,
  currencyGained: 0,
  currentXP: 0,
  xpForNextLevel: 250,
});

const emit = defineEmits<{
  (e: "close"): void;
}>();

const showXpAnimation = ref(false);

const xpProgressBefore = computed(() => {
  const xpInCurrentLevel = props.currentXP % props.xpForNextLevel;
  return Math.min(100, (xpInCurrentLevel / props.xpForNextLevel) * 100);
});

const xpGainPercent = computed(() => {
  const xpInCurrentLevel = props.currentXP % props.xpForNextLevel;
  const remainingXP = props.xpForNextLevel - xpInCurrentLevel;
  return Math.min(100, (Math.min(props.xpGained, remainingXP) / props.xpForNextLevel) * 100);
});

watch(() => props.isOpen, (open) => {
  if (open) {
    setTimeout(() => {
      showXpAnimation.value = true;
    }, 100);
  }
});

const handleClose = () => {
  emit("close");
};

const formatReason = (reason: string): string => {
  switch (reason) {
    case "timeout":
      return "Opponent ran out of time";
    case "noUnits":
      return "Opponent has no units left";
    case "kingDefeated":
      return "King defeated";
    default:
      return "Game ended";
  }
};

const formatDuration = (seconds?: number): string => {
  if (!seconds) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const hasUnitStats = computed(() => {
  const s = props.stats;
  return (s.meleeKilled || s.rangedKilled || s.mageKilled || s.healerKilled || 
          s.cavalryKilled || s.scoutKilled || s.tankKilled || s.kingKilled ||
          s.meleeLost || s.rangedLost || s.mageLost || s.tankLost);
});

interface MvpUnit {
  type: string;
  kills: number;
  damage: number;
  healing: number;
}

const mvpUnit = computed((): MvpUnit | null => {
  const s = props.stats;
  const units = [
    { type: 'melee', kills: s.meleeKilled || 0, damage: s.meleeDamage || 0, healing: 0 },
    { type: 'ranged', kills: s.rangedKilled || 0, damage: s.rangedDamage || 0, healing: 0 },
    { type: 'mage', kills: s.mageKilled || 0, damage: s.mageDamage || 0, healing: 0 },
    { type: 'healer', kills: s.healerKilled || 0, damage: s.healerDamage || 0, healing: s.healerHealing || 0 },
    { type: 'cavalry', kills: s.cavalryKilled || 0, damage: s.cavalryDamage || 0, healing: 0 },
    { type: 'scout', kills: s.scoutKilled || 0, damage: s.scoutDamage || 0, healing: 0 },
    { type: 'tank', kills: s.tankKilled || 0, damage: s.tankDamage || 0, healing: 0 },
    { type: 'king', kills: s.kingKilled || 0, damage: s.kingDamage || 0, healing: 0 },
  ];
  
  if (units.every(u => u.kills === 0 && u.damage === 0)) return null;
  
  return units.reduce((best, current) => {
    const currentScore = current.kills * 10 + current.damage / 10 + current.healing / 5;
    const bestScore = best.kills * 10 + best.damage / 10 + best.healing / 5;
    return currentScore > bestScore ? current : best;
  });
});

const formatUnitName = (name: string): string => {
  return name.charAt(0).toUpperCase() + name.slice(1);
};
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.85);
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
  font-size: 2rem;
  font-weight: bold;
  margin-bottom: 0.5rem;
}

.modal-title.win {
  color: var(--color-gold);
  text-shadow: 0 0 20px rgba(234, 179, 8, 0.5);
}

.modal-title.loss {
  color: var(--color-gray-400);
}

.win-reason {
  color: var(--color-gray-300);
  font-size: 1rem;
  margin-bottom: 1.5rem;
}

.xp-section {
  background-color: var(--color-primary);
  border-radius: 0.75rem;
  padding: 1rem;
  margin-bottom: 1.5rem;
}

.xp-bar-container {
  width: 100%;
}

.xp-bar-label {
  color: var(--color-gray-400);
  font-size: 0.75rem;
  margin-bottom: 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.xp-bar-track {
  position: relative;
  height: 16px;
  background-color: var(--color-gray-800);
  border-radius: 8px;
  overflow: hidden;
}

.xp-bar-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: linear-gradient(90deg, var(--color-cyan-600), var(--color-cyan-400));
  border-radius: 8px;
  transition: width 0.5s ease-out;
}

.xp-bar-fill.xp-gaining {
  background: linear-gradient(90deg, var(--color-emerald-500), var(--color-green-400));
}

.xp-bar-fill.xp-gaining.animate {
  animation: xpGlow 1s ease-out forwards;
}

@keyframes xpGlow {
  0% {
    filter: brightness(1);
  }
  50% {
    filter: brightness(1.5);
  }
  100% {
    filter: brightness(1);
  }
}

.xp-bar-values {
  display: flex;
  justify-content: space-between;
  color: var(--color-gray-400);
  font-size: 0.75rem;
  margin-top: 0.25rem;
}

.xp-gain-text {
  color: var(--color-cyan-400);
  font-weight: bold;
}

.level-up {
  color: var(--color-gold);
  font-size: 1.125rem;
  font-weight: bold;
  margin-top: 1rem;
  animation: levelUpPulse 1s ease-out;
}

@keyframes levelUpPulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}

.stats-section {
  margin-bottom: 1.5rem;
}

.stats-title {
  color: white;
  font-size: 1rem;
  margin-bottom: 1rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.stat-item {
  background-color: var(--color-primary);
  border-radius: 0.5rem;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
}

.stat-value {
  color: var(--color-cyan-400);
  font-size: 1.5rem;
  font-weight: bold;
}

.stat-value.loss {
  color: var(--color-red-400);
}

.stat-label {
  color: var(--color-gray-400);
  font-size: 0.75rem;
  margin-top: 0.25rem;
}

.modal-actions {
  display: flex;
  justify-content: center;
}

.close-btn {
  padding: 1rem 3rem;
  background-color: var(--color-emerald-500);
  color: white;
  font-weight: bold;
  font-size: 1.125rem;
  border: none;
  border-bottom: 4px solid var(--color-emerald-700);
  border-right: 4px solid var(--color-emerald-700);
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.1s;
}

.close-btn:hover {
  filter: brightness(1.1);
}

.close-btn:active {
  transform: translateY(2px);
  border-bottom-width: 2px;
  border-right-width: 2px;
}
</style>
