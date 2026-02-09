<template>
  <div class="game-page">
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
            <div class="player-avatar-placeholder"></div>
            <div class="player-info">
              <span class="player-name">{{ authStore.displayName }}</span>
              <span class="player-label">You ({{ gameSession.isHost ? 'Host' : 'Player 1' }})</span>
            </div>
            <div class="player-status ready">Ready</div>
          </div>

          <div class="vs-badge">VS</div>

          <div class="player-card opponent">
            <div class="player-avatar-placeholder"></div>
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
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { useRoute, RouterLink } from "vue-router";
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
  if (!gameSession.value?.serverUrl) {
    console.log("[GAME] No serverUrl, skipping game server connection");
    return;
  }

  const serverUrl = gameSession.value.serverUrl;
  const gameId = gameSession.value.id;
  const userId = authStore.user?.id;

  console.log("[GAME] Connecting to game server URL:", serverUrl);
  console.log("[GAME] Game ID:", gameId);
  console.log("[GAME] User ID:", userId);

  if (!gameId || !userId) {
    console.error("[GAME] ERROR: gameId or userId is undefined!");
    return;
  }

  socket = io(serverUrl, {
    path: "/socket.io",
    query: {
      gameId,
      userId,
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
  fetchGameDetails();
});

onUnmounted(() => {
  socket?.disconnect();
});
</script>

<style scoped>
.game-page {
  min-height: 100vh;
  background-color: #0f0f2b;
  display: flex;
  align-items: center;
  justify-content: center;
}

.game-content {
  text-align: center;
  padding: 2rem;
}

.game-header {
  position: absolute;
  top: 2rem;
  left: 2rem;
}

.back-link {
  color: white;
  text-decoration: none;
  font-size: 1rem;
  opacity: 0.8;
}

.back-link:hover {
  opacity: 1;
}

.game-container {
  background-color: #1a1a3e;
  padding: 2rem;
  border-radius: 1rem;
  max-width: 600px;
  width: 100%;
}

.loading-state,
.error-state {
  color: white;
}

.game-info {
  margin-bottom: 2rem;
}

.game-id {
  font-size: 1rem;
  color: #888;
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
  color: #4ade80;
}

.game-status.in_progress {
  color: #facc15;
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
  background-color: #0f0f2b;
  border-radius: 0.5rem;
  width: 180px;
}

.player-avatar-placeholder {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background-color: #333;
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
  color: #888;
  font-size: 0.75rem;
}

.player-status {
  font-size: 0.875rem;
  color: #facc15;
}

.player-status.ready {
  color: #4ade80;
}

.vs-badge {
  font-size: 1.5rem;
  font-weight: bold;
  color: #0f0f2b;
  background-color: white;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
}

.server-notice {
  color: #facc15;
  margin-bottom: 1.5rem;
  font-size: 0.875rem;
}

.game-actions {
  display: flex;
  justify-content: center;
}

.error-state a {
  color: #22d3ee;
}
</style>
