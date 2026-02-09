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

    <div v-else-if="gameSession" class="game-layout">
      <!-- Lobby Overlay -->
      <div v-if="showLobby" class="lobby-overlay" :class="{ 'lobby-exit': lobbyExiting }">
        <div class="lobby-content">
          <div class="lobby-players">
            <div class="lobby-player">
              <img :src="gameSession.isHost ? authStore.user?.avatar : gameSession.opponent?.avatar" class="lobby-avatar" />
              <span class="lobby-name">{{ gameSession.isHost ? authStore.displayName : gameSession.opponent?.displayName }}</span>
              <span class="lobby-label">HOST</span>
            </div>
            <div class="vs-badge-large">VS</div>
            <div class="lobby-player">
              <img :src="gameSession.isHost ? gameSession.opponent?.avatar : authStore.user?.avatar" class="lobby-avatar" />
              <span class="lobby-name">{{ gameSession.isHost ? gameSession.opponent?.displayName : authStore.displayName }}</span>
              <span class="lobby-label">CHALLENGER</span>
            </div>
          </div>
          <p class="lobby-subtitle">Game starting soon...</p>
        </div>
      </div>

      <!-- Game Canvas -->
      <canvas ref="gameCanvas" class="game-canvas" tabindex="0" :class="{ 'hidden': showLobby }"></canvas>

      <div class="game-hud">
        <div class="game-info-bar">
          <div class="player-timer" :class="{ 'active-turn': isPlayer1Turn }">
            <img :src="gameSession.isHost ? authStore.user?.avatar : gameSession.opponent?.avatar" class="timer-avatar" />
            <span class="timer-name">{{ gameSession.isHost ? authStore.displayName : gameSession.opponent?.displayName }}</span>
            <span class="timer-value">{{ formatTime(player1Time) }}</span>
          </div>

          <div class="turn-indicator" :class="{ 'my-turn': isPlayer1Turn }">
            {{ isPlayer1Turn ? 'HOST TURN' : 'CHALLENGER TURN' }}
          </div>

          <div class="player-timer opponent" :class="{ 'active-turn': !isPlayer1Turn }">
            <img :src="gameSession.isHost ? gameSession.opponent?.avatar : authStore.user?.avatar" class="timer-avatar" />
            <span class="timer-name">{{ gameSession.isHost ? gameSession.opponent?.displayName : authStore.displayName }}</span>
            <span class="timer-value">{{ formatTime(player2Time) }}</span>
          </div>
        </div>

        <div class="game-controls">
          <PlayButton
            v-if="isPlayer1Turn && gameSession.isHost"
            text="END TURN"
            color="cyan"
            @click="endTurn"
          />
          <PlayButton
            v-else-if="!isPlayer1Turn && !gameSession.isHost"
            text="END TURN"
            color="cyan"
            @click="endTurn"
          />
        </div>
      </div>
    </div>

    <div v-else class="error-state">
      <p>Game not found</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { alerts } from "../composables/useAlerts";
import { io, Socket } from "socket.io-client";
import { inflate } from 'pako';
import { useGameEngine } from "../game-engine";
import { GameState } from "../game-engine/types";
import PlayButton from "../components/PlayButton.vue";

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
const playerIndex = ref<number>(-1);
const player1Time = ref(600);
const player2Time = ref(600);
const currentRound = ref(0);
const pendingState = ref<GameState | null>(null);

let socket: Socket | null = null;

const { initSocket, start, stop, updateState } = useGameEngine(gameCanvas);

const isPlayer1Turn = computed(() => {
  return currentRound.value % 2 === 0;
});

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
    const response = await fetch(url, { credentials: "include" });
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
  console.log("[GAME] isHost:", gameSession.value.isHost);

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
    console.log("[GAME] About to call initSocket");
    loading.value = false;
    initSocket(socket, {
      gameId: gameSessionId,
      isHost: gameSession.value.isHost,
      opponent: gameSession.value.opponent
    });
    console.log("[GAME] initSocket called successfully");
    socket?.emit('join', { gameId: gameSessionId, name: userName, avatar: userAvatar });
    console.log("[GAME] Join emitted");
  });

  socket.on("connect_error", (err: Error) => {
    console.error("[GAME] Connect error:", err.message);
  });

  socket.on("joined", (data: any) => {
    console.log("[GAME] Joined game:", data);
    connectedToGameServer.value = true;
    playerIndex.value = data.playerIndex;
  });

  socket.on("error", (err: any) => {
    console.error("[GAME] Server error:", err);
  });

  socket.on("state", (compressedData: any) => {
    console.log("[GAME] Received state event");
    try {
      const decompressed = inflate(compressedData, { to: 'string' });
      const state = JSON.parse(decompressed);
      console.log("[GAME] Players in state:", state.players?.length);
      console.log("[GAME] Round in state:", state.round);
      
      // Always update timers and round
      if (state.player1Time !== undefined) player1Time.value = state.player1Time;
      if (state.player2Time !== undefined) player2Time.value = state.player2Time;
      if (state.round !== undefined) currentRound.value = state.round;
      
      // Check if game has already started (has units)
      const hasUnits = state.players?.some((p: any) => p.units?.length > 0);
      console.log("[GAME] Has units:", hasUnits, "showLobby:", showLobby.value, "connected:", connectedToGameServer.value);
      
      // Mark as connected
      connectedToGameServer.value = true;
      
      // If game has started and we're still showing lobby/connecting, skip to game
      if (hasUnits && (showLobby.value || loading.value)) {
        console.log("[GAME] Game already started, showing canvas immediately");
        loading.value = false;
        showLobby.value = false;
      }
      
      // Ensure lobby is hidden if game has units
      if (hasUnits) {
        showLobby.value = false;
      }
      
      // Update game state if canvas is ready
      if (gameCanvas.value && !showLobby.value) {
        console.log("[GAME] Calling updateGameState");
        updateGameState(state);
        pendingState.value = null;
      } else if (hasUnits) {
        // Game started but canvas not ready yet, queue it
        console.log("[GAME] Canvas not ready, queuing state update");
        pendingState.value = state;
      }
    } catch (err) {
      console.error("[GAME] Error parsing state:", err);
    }
  });

  socket.on("start", (data: { round: number }) => {
    console.log("[GAME] Game started! Round:", data.round);
    currentRound.value = data.round;
    showLobby.value = false;
    connectedToGameServer.value = true;
    loading.value = false;
    
    // Wait for next tick to ensure canvas is rendered
    setTimeout(() => {
      console.log("[GAME] About to call start(), canvas exists:", !!gameCanvas.value);
      if (gameCanvas.value) {
        console.log("[GAME] Canvas exists, calling start()");
        start();
        
        // Apply pending state if exists
        if (pendingState.value) {
          console.log("[GAME] Applying pending state");
          setTimeout(() => {
            updateGameState(pendingState.value!);
            pendingState.value = null;
          }, 50);
        }
        
        // Retry mechanism: if still no render after 500ms, try again
        setTimeout(() => {
          const canvas = document.querySelector('.game-canvas');
          if (canvas && !canvas.getAttribute('data-started')) {
            console.log("[GAME] Retry: Canvas may not have rendered, restarting...");
            start();
          }
        }, 500);
      } else {
        console.log("[GAME] ERROR: Canvas does not exist!");
      }
    }, 100);
  });

  socket.on("turn", (data: { round: number }) => {
    console.log("[GAME] Turn changed, round:", data.round, "playerIndex:", playerIndex.value);
    currentRound.value = data.round;
  });

  socket.on("disconnect", (reason) => {
    console.log("[GAME] Disconnected from game server:", reason);
    if (gameSession.value && !isEnding.value) {
      console.log("[GAME] Calling stop()");
      stop();
      console.log("[GAME] Navigating to /play");
      alerts.info("Game ended - disconnected");
      router.push("/play");
    }
  });
};

function updateGameState(state: GameState) {
  console.log("[GAME] updateGameState called");
  updateState(state);
}

const endTurn = () => {
  console.log("[GAME] End turn clicked");
  socket?.emit('endTurn');
};

watch([() => player1Time.value, () => player2Time.value], () => {
  console.log("[GAME] Timer update:", player1Time.value, player2Time.value);
});

// Watch for lobby closing and focus canvas
watch(() => showLobby.value, (newVal) => {
  if (!newVal) {
    console.log("[GAME] Lobby closed, focusing canvas");
    setTimeout(() => {
      gameCanvas.value?.focus();
      console.log("[GAME] Canvas focused:", document.activeElement === gameCanvas.value);
    }, 100);
  }
});

// Backup: If game has started but start() wasn't called, call it when canvas appears
watch(() => gameCanvas.value, (newVal) => {
  if (newVal && !showLobby.value && !pendingState.value) {
    console.log("[GAME] Canvas appeared while game in progress, starting...");
    start();
  }
});

onMounted(() => {
  console.log("[GAME] onMounted called");
  console.log("[GAME] gameCanvas.value:", !!gameCanvas.value);
  fetchGameDetails();
});

onUnmounted(() => {
  socket?.disconnect();
  stop();
});
</script>

<style scoped>
.game-page {
  width: 100vw;
  height: 100vh;
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
  background-color: #0f0f2b;
}

.game-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: block;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
  outline: none;
  border: 2px solid red; /* DEBUG: remove later */
}

.game-canvas.hidden {
  display: none;
}

.game-hud {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  pointer-events: none;
  z-index: 10;
}

.game-info-bar {
  display: flex;
  align-items: center;
  gap: 2rem;
  padding: 0.75rem 1.5rem;
  background: rgba(26, 26, 62, 0.9);
  border-radius: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  pointer-events: auto;
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

.game-controls {
  pointer-events: auto;
}
</style>
