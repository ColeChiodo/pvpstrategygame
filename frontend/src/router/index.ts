import { createRouter, createWebHistory } from "vue-router";
import { ref } from "vue";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "landing",
      component: () => import("../views/Landing.vue"),
    },
    {
      path: "/home",
      name: "home",
      component: () => import("../views/Landing.vue"),
    },
    {
      path: "/login",
      name: "login",
      component: () => import("../views/Login.vue"),
    },
    {
      path: "/play",
      name: "play",
      component: () => import("../views/Play.vue"),
    },
    {
      path: "/patch-notes",
      name: "patch-notes",
      component: () => import("../views/PatchNotes.vue"),
    },
    {
      path: "/terms",
      name: "terms",
      component: () => import("../views/Terms.vue"),
    },
    {
      path: "/about",
      name: "about",
      component: () => import("../views/About.vue"),
    },
  ],
});

export const needsTermsAccept = ref(false);

let authCheckPromise: Promise<void> | null = null;

router.beforeEach(async (to, _from, next) => {
  const { useAuthStore } = await import("../stores/auth");
  const authStore = useAuthStore();

  if (!authCheckPromise) {
    authCheckPromise = authStore.checkAuth().then(() => {});
  }

  if (authStore.isLoading) {
    await authCheckPromise;
  }

  if (to.path === "/login") {
    if (authStore.isAuthenticated) {
      next({ name: "play" });
      return;
    }
  }

  if (to.path === "/play") {
    if (!authStore.isAuthenticated) {
      next({ name: "login" });
      return;
    }

    if (!authStore.hasAcceptedTerms) {
      needsTermsAccept.value = true;
    }
  }

  next();
});

export default router;
