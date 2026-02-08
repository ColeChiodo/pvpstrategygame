import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig(({ mode }) => {
  // Load environment variables
  const env = loadEnv(mode, process.cwd(), "VITE_");

  return {
    plugins: [vue()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      host: "0.0.0.0",      // bind to all interfaces
      port: 5173,
      allowedHosts: "all",
      strictPort: false,
      hmr: {
        host: "fortezza.colechiodo.cc", // <-- fixes HMR via proxy
        protocol: "wss",                 // if using HTTPS / WebSocket via Cloudflare
      },
      proxy: {
        "/api": {
          target: env.VITE_API_URL,
          changeOrigin: true,
        },
        "/auth": {
          target: env.VITE_API_URL,
          changeOrigin: true,
        },
        "/socket.io": {
          target: env.VITE_API_URL,
          ws: true,
        },
      },
    },
  };
});

