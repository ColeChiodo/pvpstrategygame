<template>
  <div class="play-page">
    <div class="parallax-container">
      <img
        src="/assets/global/bgs/clouds/Clouds_4/1.png"
        alt="Cloud layer 1"
        class="parallax-layer layer-1"
        :style="getLayerStyle(0.005)"
      />
      <img
        src="/assets/global/bgs/clouds/Clouds_4/2.png"
        alt="Cloud layer 2"
        class="parallax-layer layer-2"
        :style="getLayerStyle(0.01)"
      />
      <img
        src="/assets/global/bgs/clouds/Clouds_4/3.png"
        alt="Cloud layer 3"
        class="parallax-layer layer-3"
        :style="getLayerStyle(0.015)"
      />
      <img
        src="/assets/global/bgs/clouds/Clouds_4/4.png"
        alt="Cloud layer 4"
        class="parallax-layer layer-4"
        :style="getLayerStyle(0.02)"
      />

      <div class="overlay"></div>

      <div class="play-content">
        <div class="play-card">
          <div class="logo-divider">
            <img
              src="/assets/landing/title.png"
              alt="Game Title"
              class="game-title"
            />
          </div>
          <div class="top-row">
            <div class="player-info" @click="showUserModal = true">
              <div class="player-avatar">
                <img
                  :src="userAvatar"
                  alt="Profile Picture"
                  class="avatar-image"
                />
              </div>
              <div class="player-details">
                <div class="player-name">{{ authStore.displayName }}</div>
                <div class="player-level">Level {{ userLevel }}</div>
              </div>
              <div class="rank-info">
                <div class="rank-badge" :class="rankTierClass">
                  {{ rankTier }}
                </div>
              </div>
            </div>
          </div>

          <div class="divider">
            <div class="online-indicator-wrapper">
              <span class="online-dot"></span>
              <span class="online-count">{{ totalPlayersOnline }} {{ totalPlayersOnline === 1 ? 'player' : 'players' }} online</span>
            </div>
          </div>

          <div class="match-section">
            <div class="match-card public-match">
              <div class="match-header">
                <h2 class="match-title">Public Match</h2>
                <QueueButton
                  text="Find Game"
                  :is-in-queue="isInQueue"
                  :queue-time="queueTime"
                  @click="startMatchmaking"
                  @cancel="leaveQueue"
                />
              </div>
              <div class="match-content">
                <img
                  src="/assets/global/fight.png"
                  alt="Fight"
                  class="match-icon"
                />
                <div class="match-stats">
                  <div class="stat">
                    <span class="stat-value">{{ wins }}-{{ losses }}</span>
                    <span class="stat-label">W-L</span>
                  </div>
                  <div class="stat">
                    <span class="stat-value">{{ streak }}</span>
                    <span class="stat-label">Streak</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="match-card private-match">
              <div class="match-header">
                <h2 class="match-title">Private Match</h2>
                <PlayButton text="Join/Create" color="emerald" />
              </div>
              <div class="match-content">
                <img
                  src="/assets/global/hand_shake.png"
                  alt="Handshake"
                  class="match-icon"
                />
              </div>
            </div>
          </div>

          <div class="bottom-row">
            <div class="footer-links">
              <RouterLink to="/patch-notes" class="footer-link">
                View Patch Notes
              </RouterLink>
              <div class="version">{{ latestVersion }}</div>
            </div>
          </div>
        </div>
      </div>

          <div v-if="showUserModal" class="modal-overlay" @click.self="showUserModal = false">
          <div class="user-modal">
            <div class="user-modal-header">
              <h2 class="modal-title">Profile</h2>
              <button class="close-btn" @click="showUserModal = false">X</button>
            </div>

          <div class="user-info-row">
            <div class="user-avatar-section" @click="showAvatarSelector = true">
              <img :src="userAvatar" alt="Profile" class="avatar-image" />
              <div class="avatar-edit-overlay">Change</div>
            </div>

            <div class="user-details">
              <div class="display-name-display">
                <span class="display-name-label">Display Name</span>
                <div v-if="!editingName" class="display-name-value editable" @click="startEditName">{{ authStore.displayName }}</div>
                <div v-else class="edit-name-row">
                  <input v-model="newDisplayName" type="text" class="name-input" placeholder="Enter new name" minlength="3" maxlength="20" ref="nameInputRef" />
                </div>
                <div v-if="editingName" class="edit-actions-row">
                  <button class="cancel-btn" @click="cancelEditName">Cancel</button>
                  <button class="save-btn" @click="saveDisplayName" :disabled="isSavingName || !isValidName">Save</button>
                </div>
              </div>
              <div class="rank-display">
                <div class="rank-badge" :class="rankTierClass">{{ rankTier }}</div>
              </div>
            </div>
          </div>

          <div class="stats-row">
            <div class="stat-item">
              <div class="stat-value">{{ authStore.user?.rank?.wins }}</div>
              <div class="stat-label">Wins</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ authStore.user?.rank?.losses }}</div>
              <div class="stat-label">Losses</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ authStore.user?.level }}</div>
              <div class="stat-label">Level</div>
            </div>
            <div class="stat-item">
              <div class="stat-value currency">{{ authStore.currency }}</div>
              <div class="stat-label">Coins</div>
            </div>
          </div>

          <button @click="handleLogout" class="logout-btn">Logout</button>
        </div>
      </div>

      <div v-if="showAvatarSelector" class="modal-overlay" @click.self="showAvatarSelector = false">
        <div class="avatar-selector-modal">
          <div class="avatar-modal-header">
            <h2 class="avatar-modal-title">Select Avatar</h2>
            <button class="close-modal-btn" @click="showAvatarSelector = false">X</button>
          </div>

          <div class="currency-display">
            <span class="currency-label">Your Coins:</span>
            <span class="currency-value">{{ authStore.currency }}</span>
          </div>

          <div v-if="loadingAvatars" class="loading-avatars">Loading avatars...</div>
          <div v-else class="avatars-grid">
            <div
              v-for="avatar in avatars"
              :key="avatar.id"
              class="avatar-item"
              :class="{ owned: avatar.owned, selected: avatar.path === userAvatar }"
              @click="handleAvatarClick(avatar)"
            >
              <img :src="avatar.path" :alt="avatar.id" class="avatar-thumbnail" />
              <div v-if="avatar.price && !avatar.owned" class="avatar-price">
                {{ avatar.price }} Coins
              </div>
              <div v-if="avatar.path === userAvatar" class="avatar-owned-label">Equipped</div>
              <div v-else-if="avatar.owned" class="avatar-owned-label">Owned</div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        v-if="pendingPurchaseAvatar"
        title="Purchase Avatar"
        :message="`Purchase ${pendingPurchaseAvatar.path} for ${pendingPurchaseAvatar.price} coins?`"
        @close="showPurchaseConfirm = false"
        @confirm="confirmPurchase"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { alerts } from "../composables/useAlerts";
import { io, Socket } from "socket.io-client";
import PlayButton from "../components/PlayButton.vue";
import QueueButton from "../components/QueueButton.vue";
import { RouterLink } from "vue-router";
import ConfirmModal from "../components/ConfirmModal.vue";

const router = useRouter();
const authStore = useAuthStore();
const showUserModal = ref(false);
const showAvatarSelector = ref(false);
const editingName = ref(false);
const newDisplayName = ref("");
const isSavingName = ref(false);
const latestVersion = ref("v0.1.0");
const loadingAvatars = ref(false);
const avatars = ref<Array<{id: string; path: string; price: number | null; owned: boolean}>>([]);
const pendingPurchaseAvatar = ref<{id: string; path: string; price: number | null; owned: boolean} | null>(null);
const showPurchaseConfirm = ref(false);
const nameInputRef = ref<HTMLInputElement | null>(null);

const isInQueue = ref(false);
const queueTime = ref(0);
const playersInQueue = ref(0);
const totalPlayersOnline = ref(0);
const k8sAvailable = ref(true);
let matchmakingSocket: Socket | null = null;
let queueTimer: any = null;
let pollTimer: any = null;
let queueCountPollTimer: any = null;

const mouseX = ref(0);
const mouseY = ref(0);

const handleMouseMove = (e: MouseEvent) => {
  mouseX.value = e.clientX;
  mouseY.value = e.clientY;
};

onMounted(async () => {
  window.addEventListener("mousemove", handleMouseMove);
  await fetchLatestVersion();

  matchmakingSocket = io(import.meta.env.VITE_API_URL, {
    path: "/socket.io",
    query: {},
  });

  matchmakingSocket.on("connect", () => {
    console.log("[MATCHMAKING] Socket connected:", matchmakingSocket?.id);
    if (authStore.user?.id) {
      console.log("[MATCHMAKING] Authenticating as user:", authStore.user.id);
      matchmakingSocket?.emit("authenticate", authStore.user.id);
    }
  });

  matchmakingSocket.on("disconnect", () => {
    console.log("[MATCHMAKING] Socket disconnected");
  });

  matchmakingSocket.on("connect_error", (err: Error) => {
    console.log("[MATCHMAKING] Socket connection error:", err.message);
  });

  matchmakingSocket.on("match:found", async (data: { gameId: string; opponent: string; serverUrl: string | null }) => {
    console.log("[MATCHMAKING] Match found via socket:", data);
    matchmakingSocket?.disconnect();
    await fetchGameDetails(data.gameId);
  });

  fetchTotalPlayersInQueue();
  startQueueCountPoll();
});

onUnmounted(() => {
  matchmakingSocket?.disconnect();
  stopQueueTimer();
  stopQueueCountPoll();
  window.removeEventListener("mousemove", handleMouseMove);
});

watch(showUserModal, (val) => {
  if (!val) {
    editingName.value = false;
    newDisplayName.value = "";
  } else {
    newDisplayName.value = authStore.displayName;
  }
});

watch(() => authStore.user?.id, (userId) => {
  if (userId && matchmakingSocket?.connected) {
    matchmakingSocket.emit("authenticate", userId);
  }
});

const isValidName = computed(() => {
  return newDisplayName.value.length >= 3 && newDisplayName.value.length <= 20;
});

const saveDisplayName = async () => {
  if (!isValidName.value || isSavingName.value) return;
  
  isSavingName.value = true;
  const success = await authStore.updateDisplayName(newDisplayName.value);
  isSavingName.value = false;
  
  if (success) {
    editingName.value = false;
    alerts.success("Display name updated!");
  } else {
    alerts.error("Failed to update display name");
  }
};

const cancelEditName = () => {
  editingName.value = false;
  newDisplayName.value = authStore.displayName;
};

const startEditName = () => {
  editingName.value = true;
  setTimeout(() => {
    nameInputRef.value?.focus();
  }, 10);
};

const fetchLatestVersion = async () => {
  try {
    const response = await fetch("/api/patch-notes/latest");
    const data = await response.json();
    latestVersion.value = data.version;
  } catch (err) {
    console.error("Failed to fetch latest version:", err);
  }
};

const getLayerStyle = (factor: number) => {
  const x = (mouseX.value - window.innerWidth / 2) * factor;
  const y = (mouseY.value - window.innerHeight / 2) * factor;
  return {
    transform: `translate(-50%, -50%) translate(${x}px, ${y}px) scale(1.1)`,
  };
};

const loadAvatars = async () => {
  loadingAvatars.value = true;
  try {
    console.log("Fetching avatars...");
    const response = await fetch("/api/avatars", {
      credentials: "include",
    });
    console.log("Response status:", response.status);
    const data = await response.json();
    console.log("Avatars API response:", data);
    console.log("Avatars array:", data.avatars);
    console.log("Avatars length:", data.avatars?.length);
    avatars.value = data.avatars || [];
    console.log("avatars.value after set:", avatars.value);
  } catch (err) {
    console.error("Failed to load avatars:", err);
  } finally {
    loadingAvatars.value = false;
    console.log("loadingAvatars set to false");
  }
};

const handleAvatarClick = async (avatar: {id: string; path: string; price: number | null; owned: boolean}) => {
  if (avatar.owned) {
    try {
      const response = await fetch("/api/avatars/equip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ avatarId: avatar.id }),
      });
      if (response.ok) {
        if (authStore.user) {
          authStore.user.avatar = avatar.path;
        }
        alerts.success("Avatar equipped!");
      }
    } catch (err) {
      console.error("Failed to equip avatar:", err);
    }
  } else if (avatar.price) {
    pendingPurchaseAvatar.value = avatar;
    showPurchaseConfirm.value = true;
  }
};

const confirmPurchase = async () => {
  const avatar = pendingPurchaseAvatar.value;
  if (!avatar || !avatar.price) return;

  try {
    const response = await fetch("/api/avatars/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ avatarId: avatar.id }),
    });
    if (response.ok) {
      avatar.owned = true;
      if (authStore.user) {
        authStore.user.xp -= avatar.price;
      }
      alerts.success("Avatar purchased!");
    } else {
      const data = await response.json();
      alerts.error(data.error || "Failed to purchase avatar");
    }
  } catch (err) {
    console.error("Failed to purchase avatar:", err);
    alerts.error("Failed to purchase avatar");
  }
};

watch(showPurchaseConfirm, (val) => {
  if (!val) {
    pendingPurchaseAvatar.value = null;
  }
});

watch(showAvatarSelector, async (val) => {
  if (val) {
    loadingAvatars.value = true;
    avatars.value = [];
    await loadAvatars();
  }
});

const userAvatar = computed(() => {
  return authStore.avatar || "/assets/avatars/free/default.png";
});

const userLevel = computed(() => {
  return authStore.user?.level || 1;
});

const rankTier = computed(() => {
  return authStore.user?.rank?.tier || "BRONZE";
});

const rankTierClass = computed(() => {
  return `rank-${rankTier.value.toLowerCase()}`;
});

const wins = computed(() => {
  return authStore.user?.rank?.wins || 0;
});

const losses = computed(() => {
  return authStore.user?.rank?.losses || 0;
});

const streak = computed(() => {
  return authStore.user?.rank?.streak || 0;
});

const handleLogout = async () => {
  await authStore.logout();
  showUserModal.value = false;
  router.push("/");
};

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const fetchTotalPlayersInQueue = async () => {
  try {
    const response = await fetch("/api/matchmaking/queue-count", {
      credentials: "include",
    });
    const data = await response.json();
    totalPlayersOnline.value = data.count || 0;
  } catch (err) {
    console.error("Failed to fetch queue count:", err);
  }
};

const startQueueCountPoll = () => {
  fetchTotalPlayersInQueue();
  queueCountPollTimer = setInterval(() => {
    fetchTotalPlayersInQueue();
  }, 15000);
};

const stopQueueCountPoll = () => {
  if (queueCountPollTimer) {
    clearInterval(queueCountPollTimer);
    queueCountPollTimer = null;
  }
};

const startMatchmaking = async () => {
  try {
    const response = await fetch("/api/matchmaking/join", {
      method: "POST",
      credentials: "include",
    });
    const data = await response.json();
    
    if (data.success) {
      isInQueue.value = true;
      startQueueTimer();
      
      if (data.matched) {
        await fetchGameDetails(data.gameId);
      } else {
        pollMatchmaking();
      }
    } else if (data.error === "Already in queue") {
      isInQueue.value = true;
      if (!queueTimer) {
        startQueueTimer();
      }
      pollMatchmaking();
    } else {
      alerts.error(data.error || "Failed to join queue");
    }
  } catch (err) {
    console.error("Failed to join queue:", err);
    alerts.error("Failed to join queue");
  }
};

const startQueueTimer = () => {
  queueTime.value = 0;
  queueTimer = setInterval(() => {
    queueTime.value++;
  }, 1000);
};

const pollMatchmaking = async () => {
  const poll = async () => {
    try {
      const response = await fetch("/api/matchmaking/status", {
        credentials: "include",
      });
      const data = await response.json();
      
      playersInQueue.value = data.queueSize || 0;
      isInQueue.value = data.inQueue;
      
      if (data.gameSession) {
        stopQueueTimer();
        await fetchGameDetails(data.gameSession.id);
        return;
      }
      
      if (!isInQueue.value) {
        return;
      }
      
      pollTimer = setTimeout(poll, 2000);
    } catch (err) {
      console.error("Polling error:", err);
      pollTimer = setTimeout(poll, 2000);
    }
  };
  
  pollTimer = setTimeout(poll, 2000);
};

const stopQueueTimer = () => {
  if (queueTimer) {
    clearInterval(queueTimer);
    queueTimer = null;
  }
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
};

const leaveQueue = async () => {
  stopQueueTimer();
  isInQueue.value = false;
  queueTime.value = 0;
  playersInQueue.value = 0;
  
  try {
    await fetch("/api/matchmaking/leave", {
      method: "POST",
      credentials: "include",
    });
  } catch (err) {
    console.error("Failed to leave queue:", err);
  }
};

const fetchGameDetails = async (gameId: string) => {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/matchmaking/game/${gameId}`, {
      credentials: "include",
    });
    const data = await response.json();
    k8sAvailable.value = !!data.serverUrl;
    isInQueue.value = false;
    stopQueueTimer();
    router.push(`/game/${gameId}`);
  } catch (err) {
    console.error("Failed to fetch game details:", err);
    alerts.error("Failed to load game");
  }
};
</script>

<style scoped>
.play-page {
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

.play-content {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  overflow: auto;
}

.play-card {
  background-color: var(--color-secondary);
  padding: 2rem;
  width: 100%;
  max-width: 600px;
  border-radius: 1rem;
  border-bottom: 4px solid var(--color-primary);
  border-right: 4px solid var(--color-primary);
  margin: 1rem;
  position: relative;
}

.play-card-online-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.online-dot {
  width: 10px;
  height: 10px;
  background-color: #22c55e;
  border-radius: 50%;
  box-shadow: 0 0 6px #22c55e;
  animation: pulse-green 2s ease-in-out infinite;
}

@keyframes pulse-green {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(1.3);
  }
}

.online-count {
  color: #22c55e;
  font-weight: 600;
  font-size: 0.875rem;
}

.logo-divider {
  width: 100%;
  height: 2px;
  background-color: rgba(255, 255, 255, 0.2);
  margin: 1rem 0;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.logo-divider .game-title {
  width: 200px;
  image-rendering: pixelated;
  background-color: var(--color-secondary);
  padding: 0 1rem;
  border: 2px solid var(--color-cyan-500);
  border-radius: 0.5rem;
}

.top-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 3rem;
  margin-bottom: 1.5rem;
}

.logo-divider .game-title {
  width: 200px;
  image-rendering: pixelated;
  background-color: var(--color-secondary);
  padding: 0 1rem;
  border: 2px solid var(--color-cyan-500);
  border-radius: 0.5rem;
}

.online-count {
  font-weight: 500;
}

.top-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.player-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem;
  background-color: var(--color-primary);
  background-color: rgba(15, 15, 43, 0.75);
  border-radius: 0.5rem;
  border: 4px solid var(--color-primary);
  cursor: pointer;
  transition: border-color 0.2s;
  width: 100%;
}

.player-info:hover {
  border-color: var(--color-cyan-600);
}

.player-avatar {
  flex-shrink: 0;
}

.avatar-image {
  width: 64px;
  height: 64px;
  image-rendering: pixelated;
  border-radius: 0.25rem;
}

.player-details {
  text-align: left;
}

.player-name {
  color: white;
  font-weight: bold;
  font-size: 1.125rem;
}

.player-level {
  color: white;
  font-size: 1rem;
}

.rank-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-left: auto;
}

.rank-badge {
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-weight: bold;
  font-size: 0.875rem;
  color: white;
}

.rank-bronze {
  background-color: #cd7f32;
}

.rank-silver {
  background-color: #c0c0c0;
  color: #333;
}

.rank-gold {
  background-color: #ffd700;
  color: #333;
}

.rank-platinum {
  background-color: #e5e4e2;
  color: #333;
}

.rank-diamond {
  background-color: #b9f2ff;
  color: #333;
}

.rank-emerald {
  background-color: #50c878;
}

.divider {
  width: 100%;
  height: 2px;
  background-color: rgba(255, 255, 255, 0.2);
  margin: 1.5rem 0;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.online-indicator-wrapper {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background-color: var(--color-secondary);
  padding: 0 1rem;
  border: 2px solid var(--color-emerald-500);
  border-radius: 1rem;
}

.online-dot {
  width: 10px;
  height: 10px;
  background-color: #22c55e;
  border-radius: 50%;
  box-shadow: 0 0 6px #22c55e;
  animation: pulse-green 2s ease-in-out infinite;
}

@keyframes pulse-green {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(1.3);
  }
}

.online-count {
  color: #22c55e;
  font-weight: 600;
  font-size: 0.875rem;
}

.match-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.match-card {
  background-color: var(--color-primary);
  background-color: rgba(15, 15, 43, 0.75);
  padding: 1rem;
  border-radius: 0.5rem;
  border: 4px solid var(--color-primary);
}

.match-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.match-title {
  color: white;
  font-size: 1.5rem;
  font-weight: bold;
}

.match-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-left: 1rem;
}

.match-icon {
  width: 80px;
  height: 80px;
  image-rendering: pixelated;
}

.match-stats {
  display: flex;
  gap: 2rem;
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-value {
  color: white;
  font-size: 1.25rem;
}

.stat-label {
  color: var(--color-gray-500);
  font-size: 0.875rem;
}

.bottom-row {
  margin-top: 1.5rem;
}

.footer-links {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}

.footer-link {
  color: var(--color-gray-500);
  text-decoration: none;
  font-size: 0.875rem;
}

.footer-link:hover {
  color: white;
}

.version {
  color: var(--color-gray-500);
  font-size: 0.875rem;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.user-modal {
  background-color: var(--color-secondary);
  padding: 1.5rem;
  border-radius: 1rem;
  border-bottom: 4px solid var(--color-primary);
  border-right: 4px solid var(--color-primary);
  max-width: 450px;
  width: 90%;
}

.user-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.modal-title {
  color: white;
  font-size: 1.25rem;
  font-weight: bold;
  margin: 0;
}

.close-btn {
  color: white;
  font-size: 1.25rem;
  font-weight: bold;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
}

.close-btn:hover {
  color: var(--color-gray-400);
}

.user-info-row {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}

.user-avatar-section {
  position: relative;
  flex-shrink: 0;
}

.avatar-image {
  width: 80px;
  height: 80px;
  image-rendering: pixelated;
  border-radius: 0.5rem;
  border: 3px solid var(--color-primary);
  cursor: pointer;
}

.avatar-edit-overlay {
  position: absolute;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.6);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 0.75rem;
  opacity: 0;
  transition: opacity 0.2s;
  border-radius: 0.5rem;
  cursor: pointer;
}

.user-avatar-section:hover .avatar-edit-overlay {
  opacity: 1;
}

.user-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.5rem;
}

.display-name-display {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.display-name-label {
  color: var(--color-gray-500);
  font-size: 0.75rem;
}

.display-name-value {
  color: white;
  font-size: 1.125rem;
  font-weight: bold;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  transition: all 0.2s;
  width: fit-content;
}

.display-name-value:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.display-name-value::after {
  content: "✎";
  font-size: 0.75rem;
  margin-left: 0.5rem;
  opacity: 0;
  transition: opacity 0.2s;
}

.display-name-value:hover::after {
  opacity: 0.7;
}

.edit-name-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.name-input {
  flex: 1;
  padding: 0.375rem 0.5rem;
  border-radius: 0.25rem;
  border: 2px solid var(--color-accent);
  background-color: var(--color-primary);
  color: white;
  font-size: 1rem;
  font-family: inherit;
  min-width: 120px;
}

.name-input:focus {
  outline: none;
}

.edit-actions-row {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.edit-actions-row .cancel-btn,
.edit-actions-row .save-btn {
  flex: 1;
  padding: 0.375rem 0.5rem;
  border-radius: 0.25rem;
  border: none;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: bold;
}

.edit-actions-row .cancel-btn {
  background-color: var(--color-gray-600);
  color: white;
}

.edit-actions-row .save-btn {
  background-color: var(--color-emerald-500);
  color: white;
}

.edit-actions-row .save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.rank-display {
  display: flex;
  align-items: center;
}

.rank-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 0.25rem;
  font-weight: bold;
  font-size: 0.875rem;
  color: white;
}

.cancel-btn, .save-btn {
  flex: 1;
  padding: 0.5rem;
  border-radius: 0.25rem;
  border: none;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: bold;
}

.cancel-btn {
  background-color: var(--color-gray-600);
  color: white;
}

.save-btn {
  background-color: var(--color-emerald-500);
  color: white;
}

.save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.stat-item {
  background-color: var(--color-primary);
  padding: 0.5rem;
  border-radius: 0.25rem;
  text-align: center;
}

.stat-value {
  color: white;
  font-size: 1rem;
  font-weight: bold;
}

.stat-value.currency {
  color: var(--color-gold);
}

.stat-label {
  color: var(--color-gray-500);
  font-size: 0.625rem;
}

.logout-btn {
  width: 100%;
  padding: 0.75rem;
  background-color: var(--color-rose-600);
  color: white;
  font-weight: bold;
  border: none;
  border-bottom: 3px solid var(--color-rose-800);
  border-right: 3px solid var(--color-rose-800);
  border-radius: 0.5rem;
  cursor: pointer;
  font-size: 0.875rem;
}

.logout-btn:hover {
  filter: brightness(1.1);
}

.logout-btn:active {
  transform: translateY(1px);
  border-bottom-width: 1px;
  border-right-width: 1px;
}

.avatar-selector-modal {
  background-color: var(--color-secondary);
  padding: 2rem;
  border-radius: 1rem;
  border-bottom: 4px solid var(--color-primary);
  border-right: 4px solid var(--color-primary);
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
}

.avatar-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.avatar-modal-title {
  color: white;
  font-size: 1.5rem;
  font-weight: bold;
}

.close-modal-btn {
  color: white;
  font-size: 1.25rem;
  font-weight: bold;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.5rem;
}

.close-modal-btn:hover {
  color: var(--color-primary);
}

.currency-display {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  padding: 0.75rem;
  background-color: var(--color-primary);
  border-radius: 0.5rem;
}

.currency-label {
  color: var(--color-gray-400);
  font-size: 0.875rem;
}

.currency-value {
  color: var(--color-gold);
  font-weight: bold;
  font-size: 1.25rem;
}

.loading-avatars {
  color: var(--color-gray-400);
  text-align: center;
  padding: 2rem;
}

.avatars-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 1rem;
}

.avatar-item {
  position: relative;
  cursor: pointer;
  border-radius: 0.5rem;
  border: 3px solid transparent;
  padding: 0.25rem;
  transition: border-color 0.2s;
}

.avatar-item:hover {
  border-color: var(--color-cyan-600);
}

.avatar-item.selected {
  border-color: var(--color-emerald-500);
}

.avatar-thumbnail {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  image-rendering: pixelated;
  border-radius: 0.25rem;
}

.avatar-price {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: rgba(0, 0, 0, 0.8);
  color: var(--color-gold);
  font-size: 0.75rem;
  font-weight: bold;
  text-align: center;
  padding: 0.25rem;
  border-radius: 0 0 0.25rem 0.25rem;
}

.avatar-owned-label {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  background-color: rgba(0, 0, 0, 0.6);
  color: white;
  font-size: 0.625rem;
  text-align: center;
  padding: 0.25rem;
  border-radius: 0.25rem 0.25rem 0 0;
}

.matchmaking-status {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  background-color: rgba(15, 15, 43, 0.5);
  border-radius: 0.5rem;
  margin-bottom: 1rem;
}

.queue-timer {
  color: var(--color-cyan-400);
  font-size: 1.25rem;
  font-weight: bold;
  font-family: monospace;
  min-width: 60px;
}

.queue-players {
  color: var(--color-gray-400);
  font-size: 0.875rem;
}

.cancel-queue-btn-small {
  margin-left: auto;
  padding: 0.375rem 0.75rem;
  background-color: var(--color-gray-600);
  color: white;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: bold;
}

.cancel-queue-btn-small:hover {
  background-color: var(--color-gray-500);
}

.game-lobby-modal {
  background-color: var(--color-secondary);
  padding: 1.5rem;
  border-radius: 1rem;
  border-bottom: 4px solid var(--color-primary);
  border-right: 4px solid var(--color-primary);
  max-width: 500px;
  width: 90%;
}

.game-lobby-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.game-id-display {
  color: var(--color-gray-400);
  font-size: 0.75rem;
  font-family: monospace;
  word-break: break-all;
  text-align: center;
  margin-bottom: 0.5rem;
}

.game-status {
  color: white;
  font-size: 1.125rem;
  font-weight: bold;
  text-align: center;
  text-transform: uppercase;
  margin-bottom: 1.5rem;
}

.game-status.waiting { color: var(--color-yellow-500); }
.game-status.match_found { color: var(--color-green-500); }
.game-status.in_progress { color: var(--color-cyan-500); }

.lobby-players {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.lobby-player {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem;
  background-color: var(--color-primary);
  border-radius: 0.5rem;
  border: 3px solid var(--color-gray-700);
  transition: border-color 0.3s;
}

.lobby-player.ready {
  border-color: var(--color-emerald-500);
}

.lobby-avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  margin-bottom: 0.5rem;
  image-rendering: pixelated;
}

.lobby-player-info {
  text-align: center;
}

.lobby-player-name {
  display: block;
  color: white;
  font-weight: bold;
  font-size: 0.875rem;
}

.lobby-player-label {
  display: block;
  color: var(--color-gray-500);
  font-size: 0.75rem;
  margin-top: 0.25rem;
}

.lobby-vs {
  color: var(--color-gray-500);
  font-weight: bold;
  font-size: 1rem;
}

.lobby-actions {
  display: flex;
  gap: 1rem;
}
</style>
