<template>
  <div class="game-page">
    <div v-if="loading" class="loading-state">
      <div class="loading-spinner"></div>
      <p>Loading game...</p>
    </div>

    <div v-else-if="gameSession && !connectedToGameServer" class="connecting-state">
      <div class="connecting-spinner"></div>
      <p>Connecting to game server...</p>
    </div>

    <div v-else-if="gameSession && showLobby" class="lobby-overlay" :class="{ 'lobby-exit': lobbyExiting }">
      <div class="lobby-content">
        <div class="lobby-players">
          <div class="lobby-player">
            <img :src="authStore.user?.avatar || '/default-avatar.png'" class="lobby-avatar" />
            <span class="lobby-name">{{ authStore.displayName }}</span>
            <span class="lobby-label">YOU</span>
          </div>
          <div class="vs-badge-large">VS</div>
          <div class="lobby-player">
            <img :src="gameSession.opponent?.avatar || '/default-avatar.png'" class="lobby-avatar" />
            <span class="lobby-name">{{ gameSession.opponent?.displayName || 'Opponent' }}</span>
            <span class="lobby-label">OPPONENT</span>
          </div>
        </div>
        <p class="lobby-subtitle">Game starting soon...</p>
      </div>
    </div>

    <div v-else-if="gameSession" class="game-layout">
      <canvas ref="gameCanvas" class="game-canvas"></canvas>

      <div class="game-hud">
        <div class="back-link-container">
          <RouterLink to="/play" class="back-link">← Back to Play</RouterLink>
        </div>

        <div class="game-info-bar">
          <div class="player-timer" :class="{ 'active-turn': isMyTurn }">
            <img :src="authStore.user?.avatar || '/default-avatar.png'" class="timer-avatar" />
            <span class="timer-name">{{ authStore.displayName }}</span>
            <span class="timer-value">{{ formatTime(player1Time) }}</span>
          </div>

          <div class="turn-indicator" :class="{ 'my-turn': isMyTurn }">
            {{ isMyTurn ? 'YOUR TURN' : 'ENEMY TURN' }}
          </div>

          <div class="player-timer opponent" :class="{ 'active-turn': !isMyTurn }">
            <img :src="gameSession.opponent?.avatar || '/default-avatar.png'" class="timer-avatar" />
            <span class="timer-name">{{ gameSession.opponent?.displayName || 'Opponent' }}</span>
            <span class="timer-value">{{ formatTime(player2Time) }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="error-state">
      <p>Game not found</p>
      <RouterLink to="/play">Return to Play</RouterLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue";
import { useRouter } from "vue-router";
import { RouterLink } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { alerts } from "../composables/useAlerts";
import { io, Socket } from "socket.io-client";
import { inflate } from 'pako';
import { useGameEngine } from "../game-engine";
import { GameState } from "../game-engine/types";

const props = defineProps<{
  gameId: string;
}>();

const router = useRouter();
const authStore = useAuthStore();
const gameCanvas = ref<HTMLCanvasElement | null>(null);

const gameSession = ref<any>(null);
const isEnding = ref(false);
const loading = ref(true);
const connectedToGameServer = ref(false);
const showLobby = ref(true);
const lobbyExiting = ref(false);
const isMyTurn = ref(false);
const playerIndex = ref<number>(-1);
const player1Time = ref(600);
const player2Time = ref(600);

let socket: Socket | null = null;

const { initSocket, start, stop, updateState } = useGameEngine(gameCanvas);

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const fetchGameDetails = async () => {
  console.log("[GAME] fetchGameDetails called for gameId:", props.gameId);
  connectedToGameServer.value = false;
  showLobby.value = true;
  lobbyExiting.value = false;
  try {
    const url = `${import.meta.env.VITE_API_URL}/api/matchmaking/game/${props.gameId}`;
    console.log("[GAME] Fetching from:", url);

    const response = await fetch(url, { credentials: "include" });
    console.log("[GAME] Response status:", response.status);
    const data = await response.json();
    console.log("[GAME] API response:", JSON.stringify(data, null, 2));

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
  const gameSessionId = gameSession.value.gameId;
  const userId = authStore.user?.id;
  const userName = authStore.displayName;
  const userAvatar = authStore.user?.avatar || "";

  console.log("[GAME] Connecting to game server URL:", serverUrl);
  console.log("[GAME] Game Session ID:", gameSessionId);
  console.log("[GAME] User:", userId, userName);

  if (!gameSessionId || !userId) {
    console.error("[GAME] ERROR: gameSessionId or userId is undefined!");
    return;
  }

  socket = io(import.meta.env.VITE_GAME_URL, {
    path: `/game/${gameSessionId}/socket.io`,
    query: { userId },
  });

  console.log("[GAME] Socket connecting to:", `${import.meta.env.VITE_GAME_URL}/game/${gameSessionId}/socket.io`);

  socket.on("connect", () => {
    console.log("[GAME] Socket connected! ID:", socket?.id);
    console.log("[GAME] Emitting join...");
    socket?.emit('join', { gameId: gameSessionId, name: userName, avatar: userAvatar });
  });

  socket.on("connect_error", (err: Error) => {
    console.error("[GAME] Connect error:", err.message);
  });

  socket.on("joined", (data: any) => {
    console.log("[GAME] Joined game:", data);
    connectedToGameServer.value = true;
    playerIndex.value = data.playerIndex;
    // Wait for "start" event to show game
  });

  socket.on("error", (err: any) => {
    console.error("[GAME] Server error:", err);
  });

  socket.on("state", (compressedData: any) => {
    try {
      const decompressed = inflate(compressedData, { to: 'string' });
      const state = JSON.parse(decompressed);
      console.log("[GAME] Received state, players:", state.players?.length, "round:", state.round);
      
      // Update timers
      if (state.player1Time !== undefined) player1Time.value = state.player1Time;
      if (state.player2Time !== undefined) player2Time.value = state.player2Time;
      
      // Show game canvas when we start receiving state
      if (gameCanvas.value) {
        showLobby.value = false;
        updateGameState(state);
      }
    } catch (err) {
      console.error("[GAME] Error parsing state:", err);
    }
  });

  socket.on("start", (data: { round: number }) => {
    console.log("[GAME] Game started! Round:", data.round, "playerIndex:", playerIndex.value);
    isMyTurn.value = playerIndex.value === 0;
    showLobby.value = false;
    
    // Start the game canvas
    if (gameCanvas.value) {
      start();
    }
  });

  socket.on("turn", (data: { round: number }) => {
    console.log("[GAME] Turn changed, round:", data.round, "playerIndex:", playerIndex.value);
    isMyTurn.value = (data.round % 2) === playerIndex.value;
  });

  socket.on("gameOver", (data: { socket: string }) => {
    console.log("[GAME] Game over, winner socket:", data.socket);
  });

  socket.on("disconnect", (reason) => {
    console.log("[GAME] Disconnected from game server:", reason);
    if (gameSession.value && !isEnding.value) {
      stop();
      alerts.info("Game ended");
      router.push("/play");
    }
  });
};

function updateGameState(state: GameState) {
  console.log("[GAME] Updating game state:", {
    players: state.players?.length,
    arena: state.arena?.name,
    round: state.round,
    p1Time: state.player1Time,
    p2Time: state.player2Time,
  });

  player1Time.value = state.player1Time || 600;
  player2Time.value = state.player2Time || 600;

  updateState(state);
}

const endGame = async () => {
  if (!gameSession.value?.gameId) {
    console.log("[END-GAME] No gameSession.gameId, aborting");
    return;
  }

  console.log("[END-GAME] Starting end game for:", gameSession.value.gameId);
  isEnding.value = true;

  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/matchmaking/game/${gameSession.value.gameId}/end`, {
      method: "POST",
      credentials: "include",
    });

    console.log("[END-GAME] Response status:", response.status);
    const result = await response.json();
    console.log("[END-GAME] Response:", result);

    if (response.ok) {
      stop();
      socket?.disconnect();
      router.push("/play");
      alerts.success("Game ended");
    } else {
      alerts.error("Failed to end game: " + (result.error || "Unknown error"));
    }
  } catch (err) {
    console.error("[END-GAME] Error:", err);
    alerts.error("Failed to end game");
  } finally {
    isEnding.value = false;
  }
};

watch(isMyTurn, (val) => {
  console.log("[GAME] isMyTurn changed:", val);
});

watch([() => player1Time.value, () => player2Time.value], () => {
  console.log("[GAME] Timer update:", player1Time.value, player2Time.value);
});

onMounted(() => {
  fetchGameDetails();
});

onUnmounted(() => {
  socket?.disconnect();
  stop();
});
</script>

<style scoped>
.game-page {
  min-height: 100vh;
  background-color: #0f0f2b;
  position: relative;
  overflow: hidden;
}

.loading-state,
.error-state {
  color: white;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  min-height: 100vh;
}

.loading-spinner,
.connecting-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: #22d3ee;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.connecting-state {
  color: white;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  min-height: 100vh;
}

.lobby-overlay {
  position: fixed;
  inset: 0;
  background-color: #0f0f2b;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  transition: opacity 1.5s ease, transform 1.5s ease;
}

.lobby-overlay.lobby-exit {
  opacity: 0;
  transform: scale(1.1);
}

.lobby-content {
  text-align: center;
  animation: fadeIn 0.5s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.lobby-players {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4rem;
  margin-bottom: 2rem;
}

.lobby-player {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.lobby-avatar {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  object-fit: cover;
  border: 4px solid #22d3ee;
  box-shadow: 0 0 30px rgba(34, 211, 238, 0.3);
}

.lobby-name {
  color: white;
  font-size: 1.5rem;
  font-weight: bold;
}

.lobby-label {
  color: #22d3ee;
  font-size: 0.875rem;
  letter-spacing: 0.2em;
}

.vs-badge-large {
  font-size: 3rem;
  font-weight: bold;
  color: #facc15;
  text-shadow: 0 0 20px rgba(250, 204, 21, 0.5);
}

.lobby-subtitle {
  color: #888;
  font-size: 1rem;
}

.game-layout {
  position: relative;
  width: 100vw;
  height: 100vh;
}

.game-canvas {
  width: 100%;
  height: 100%;
  display: block;
}

.game-hud {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  pointer-events: none;
}

.back-link-container {
  position: absolute;
  top: 1rem;
  left: 1rem;
  z-index: 10;
}

.back-link {
  color: white;
  text-decoration: none;
  font-size: 1rem;
  opacity: 0.8;
  padding: 0.5rem 1rem;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 0.5rem;
  transition: opacity 0.2s;
}

.back-link:hover {
  opacity: 1;
}

.game-info-bar {
  position: absolute;
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 2rem;
  padding: 0.75rem 1.5rem;
  background: rgba(26, 26, 62, 0.9);
  border-radius: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.player-timer {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  transition: all 0.3s;
}

.player-timer.active-turn {
  background: rgba(34, 211, 238, 0.2);
  border: 1px solid #22d3ee;
}

.timer-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
}

.timer-name {
  color: white;
  font-weight: bold;
  font-size: 0.875rem;
}

.timer-value {
  font-family: monospace;
  font-size: 1.25rem;
  color: #facc15;
}

.player-timer.opponent .timer-name,
.player-timer.opponent .timer-value {
  color: #f97316;
}

.player-timer.opponent.active-turn {
  background: rgba(249, 115, 22, 0.2);
  border-color: #f97316;
}

.player-timer.opponent.active-turn .timer-value {
  color: #f97316;
}

.turn-indicator {
  padding: 0.5rem 1.5rem;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 0.5rem;
  color: #888;
  font-weight: bold;
  font-size: 0.75rem;
  letter-spacing: 0.1em;
}

.turn-indicator.my-turn {
  background: rgba(34, 211, 238, 0.3);
  color: #22d3ee;
}

.error-state a {
  color: #22d3ee;
}
</style>
