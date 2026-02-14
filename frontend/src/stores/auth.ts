import { defineStore } from "pinia";
import { ref, computed } from "vue";

export interface User {
  id: string;
  username: string;
  displayName: string;
  email: string;
  avatar: string;
  level: number;
  xp: number;
  currency: number;
  rank: {
    elo: number;
    tier: string;
    wins: number;
    losses: number;
    streak: number;
    longestStreak: number;
  };
  hasAcceptedTerms: boolean;
  isAdmin: boolean;
}

export const useAuthStore = defineStore("auth", () => {
  const user = ref<User | null>(null);
  const isLoading = ref(true);
  const authCheckPromise = ref<Promise<boolean> | null>(null);
  const isAuthenticated = computed(() => user.value !== null);
  const hasAcceptedTerms = computed(() => user.value?.hasAcceptedTerms ?? false);
  const displayName = computed(() => user.value?.displayName ?? "");
  const avatar = computed(() => user.value?.avatar ?? "/assets/avatars/free/default.png");
  const xp = computed(() => user.value?.xp ?? 0);
  const currency = computed(() => user.value?.currency ?? 0);
  const isAdmin = computed(() => user.value?.isAdmin ?? false);

  async function checkAuth() {
    if (authCheckPromise.value) {
      return authCheckPromise.value;
    }

    authCheckPromise.value = (async () => {
      try {
        const response = await fetch("/api/auth/status", {
          credentials: "include",
        });
        const data = await response.json();
        if (data.authenticated && data.user) {
          user.value = data.user;
          return true;
        }
        return false;
      } catch (err) {
        console.error("Auth check failed:", err);
        return false;
      } finally {
        isLoading.value = false;
      }
    })();

    return authCheckPromise.value;
  }

  async function forceCheckAuth() {
    authCheckPromise.value = null;
    return checkAuth();
  }

  async function updateDisplayName(newName: string) {
    try {
      const response = await fetch("/api/auth/update-display-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ displayName: newName }),
      });
      if (response.ok && user.value) {
        user.value.displayName = newName;
        return true;
      }
      return false;
    } catch (err) {
      console.error("Failed to update display name:", err);
      return false;
    }
  }

  async function acceptTerms() {
    try {
      const response = await fetch("/api/auth/accept-terms", {
        method: "POST",
        credentials: "include",
      });
      if (response.ok && user.value) {
        user.value.hasAcceptedTerms = true;
        return true;
      }
      return false;
    } catch (err) {
      console.error("Failed to accept terms:", err);
      return false;
    }
  }

  async function loginWithGoogle() {
    window.location.href = "/api/auth/google";
  }

  async function loginWithDiscord() {
    window.location.href = "/api/auth/discord";
  }

  async function logout() {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    user.value = null;
  }

  return {
    user,
    isLoading,
    isAuthenticated,
    hasAcceptedTerms,
    displayName,
    avatar,
    xp,
    currency,
    isAdmin,
    checkAuth,
    forceCheckAuth,
    updateDisplayName,
    acceptTerms,
    loginWithGoogle,
    loginWithDiscord,
    logout,
  };
});

