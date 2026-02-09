<template>
  <div class="game-page">
    <div class="parallax-container">
      <img src="/assets/fortezza-bg-1.png" class="parallax-layer layer-1" :style="layer1Style" />
      <img src="/assets/fortezza-bg-2.png" class="parallax-layer layer-2" :style="layer2Style" />
      <img src="/assets/fortezza-bg-3.png" class="parallax-layer layer-3" :style="layer3Style" />
      <img src="/assets/fortezza-bg-4.png" class="parallax-layer layer-4" :style="layer4Style" />

      <div class="overlay"></div>

      <div class="game-content">
        <div class="game-header">
          <RouterLink to="/play" class="back-link">← Back to Play</RouterLink>
        </div>

        <div v-if="loading" class="loading-state">Loading game...</div>

        <div v-else-if="gameSession" class="game-container">
          <div class="game-info">
            <h2 class="game-id">{{ gameSession.id }}</h2>
            <span class="game-status" :class="gameSession.status">{{ gameSession.status }}</span>
          </div>

          <div class="players-container">
            <div class="player-card host">
              <img :src="userAvatar" alt="Your Avatar" class="player-avatar" />
              <div class="player-info">
                <span class="player-name">{{ authStore.displayName }}</span>
                <span class="player-label">You ({{ gameSession.isHost ? 'Host' : 'Player 1' }})</span>
              </div>
              <div class="player-status ready">Ready</div>
            </div>

            <div class="vs-badge">VS</div>

            <div class="player-card opponent">
              <img :src="gameSession.opponent?.avatar || '/assets/avatars/free/default.png'" alt="Opponent Avatar" class="player-avatar" />
              <div class="player-info">
                <span class="player-name">{{ gameSession.opponent?.displayName || 'Connecting...' }}</span>
                <span class="player-label">{{ opponentConnected ? 'Connected' : 'Waiting...' }}</span>
              </div>
              <div class="player-status" :class="{ ready: opponentConnected }">
                {{ opponentConnected ? 'Ready' : 'Connecting...' }}
              </div>
            </div>
          </div>

          <div v-if="!gameSession.serverUrl" class="server-notice">
            Game server is starting up...
          </div>

          <div class="game-actions">
            <PlayButton
              v-if="gameSession.isHost"
              text="End Game"
              color="rose"
              :disabled="isEnding"
              @click="endGame"
            />
            <PlayButton
              v-else
              text="Waiting for host..."
              color="gray"
              disabled
            />
          </div>
        </div>

        <div v-else class="error-state">
          <p>Game not found</p>
          <RouterLink to="/play">Return to Play</RouterLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRouter, useRoute, RouterLink } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { alerts } from "../composables/useAlerts";
import { io, Socket } from "socket.io-client";
import PlayButton from "../components/PlayButton.vue";

const props = defineProps<{
  gameId: string;
}>();

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const gameSession = ref<any>(null);
const opponentConnected = ref(false);
const isEnding = ref(false);
const loading = ref(true);
let socket: Socket | null = null;

const mouseX = ref(0);
const mouseY = ref(0);

const layer1Style = computed(() => ({
  transform: `translate(-50%, -50%) translate(${mouseX.value * -0.02}px, ${mouseY.value * -0.02}px)`,
}));

const layer2Style = computed(() => ({
  transform: `translate(-50%, -50%) translate(${mouseX.value * -0.05}px, ${mouseY.value * -0.05}px)`,
}));

const layer3Style = computed(() => ({
  transform: `translate(-50%, -50%) translate(${mouseX.value * -0.1}px, ${mouseY.value * -0.1}px)`,
}));

const layer4Style = computed(() => ({
  transform: `translate(-50%, -50%) translate(${mouseX.value * -0.15}px, ${mouseY.value * -0.15}px)`,
}));

const userAvatar = computed(() => authStore.user?.avatar || "/assets/avatars/free/default.png");

const handleMouseMove = (e: MouseEvent) => {
  mouseX.value = e.clientX - window.innerWidth / 2;
  mouseY.value = e.clientY - window.innerHeight / 2;
};

const fetchGameDetails = async () => {
  try {
    const response = await fetch(`/api/matchmaking/game/${props.gameId}`, {
      credentials: "include",
    });
    const data = await response.json();
    gameSession.value = data;
    loading.value = false;

    if (data.serverUrl) {
      connectToGameServer();
    }
  } catch (err) {
    console.error("Failed to fetch game details:", err);
    alerts.error("Failed to load game");
    loading.value = false;
  }
};

const connectToGameServer = () => {
  if (!gameSession.value?.serverUrl) return;

  socket = io(gameSession.value.serverUrl, {
    query: {
      gameId: gameSession.value.id,
      userId: authStore.user?.id,
    },
  });

  socket.on("connect", () => {
    console.log("Connected to game server");
  });

  socket.on("game:joined", (data: any) => {
    console.log("Joined game:", data);
    opponentConnected.value = data.players.length >= 2;
  });

  socket.on("player:joined", (data: any) => {
    console.log("Player joined:", data);
    if (data.players.length >= 2) {
      opponentConnected.value = true;
    }
  });

  socket.on("player:left", () => {
    opponentConnected.value = false;
  });

  socket.on("game:started", () => {
    alerts.success("Game started!");
  });

  socket.on("game:ended", () => {
    alerts.info("Game ended");
    router.push("/play");
  });
};

const endGame = async () => {
  if (!gameSession.value?.id) return;

  isEnding.value = true;

  try {
    const response = await fetch(`/api/matchmaking/game/${gameSession.value.id}/end`, {
      method: "POST",
      credentials: "include",
    });

    if (response.ok) {
      socket?.disconnect();
      router.push("/play");
      alerts.success("Game ended");
    } else {
      alerts.error("Failed to end game");
    }
  } catch (err) {
    console.error("Failed to end game:", err);
    alerts.error("Failed to end game");
  } finally {
    isEnding.value = false;
  }
};

onMounted(() => {
  window.addEventListener("mousemove", handleMouseMove);
  fetchGameDetails();
});

onUnmounted(() => {
  window.removeEventListener("mousemove", handleMouseMove);
  socket?.disconnect();
});
</script>

<style scoped>
.game-page {
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

.overlay {
  position: absolute;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.85);
  z-index: 2;
}

.layer-1 { z-index: 1; }
.layer-2 { z-index: 1; }
.layer-3 { z-index: 1; }
.layer-4 { z-index: 1; }

.game-content {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 10;
  overflow: auto;
}

.game-header {
  position: absolute;
  top: 2rem;
  left: 2rem;
  z-index: 20;
}

.back-link {
  color: white;
  text-decoration: none;
  font-size: 1rem;
  opacity: 0.8;
  transition: opacity 0.2s;
}

.back-link:hover {
  opacity: 1;
}

.game-container {
  background-color: var(--color-secondary);
  padding: 2rem;
  border-radius: 1rem;
  border-bottom: 4px solid var(--color-primary);
  border-right: 4px solid var(--color-primary);
  text-align: center;
  max-width: 600px;
  width: 100%;
}

.loading-state,
.error-state {
  color: white;
  text-align: center;
}

.game-info {
  margin-bottom: 2rem;
}

.game-id {
  font-size: 1rem;
  color: var(--color-gray-400);
  margin-bottom: 0.5rem;
}

.game-status {
  padding: 0.25rem 1rem;
  border-radius: 1rem;
  font-size: 0.875rem;
  font-weight: bold;
  text-transform: uppercase;
}

.game-status.match_found {
  color: var(--color-green-400);
}

.game-status.in_progress {
  color: var(--color-yellow-400);
}

.players-container {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2rem;
  margin-bottom: 2rem;
}

.player-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background-color: var(--color-primary);
  border-radius: 0.5rem;
  border: 4px solid var(--color-primary);
  width: 180px;
}

.player-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  object-fit: cover;
}

.player-info {
  display: flex;
  flex-direction: column;
}

.player-name {
  color: white;
  font-weight: bold;
}

.player-label {
  color: var(--color-gray-400);
  font-size: 0.75rem;
}

.player-status {
  font-size: 0.875rem;
  color: var(--color-yellow-400);
}

.player-status.ready {
  color: var(--color-green-400);
}

.vs-badge {
  font-size: 1.5rem;
  font-weight: bold;
  color: var(--color-primary);
  background-color: white;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
}

.server-notice {
  color: var(--color-yellow-400);
  margin-bottom: 1.5rem;
  font-size: 0.875rem;
}

.game-actions {
  display: flex;
  justify-content: center;
}

.error-state a {
  color: var(--color-cyan-400);
}
</style>
