import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig(({ mode }) => {
  // Load environment variables
  const env = loadEnv(mode, process.cwd(), "VITE_");

  return {
    plugins: [vue()],
    root: ".", // <-- ensure Vite root is the container working directory
	base: "/",
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      host: "0.0.0.0",      // bind to all interfaces
      port: 5173,
      strictPort: true,     // fail if port is in use
      fs: {
        strict: false,      // <-- allow serving files outside root if needed
      },
      allowedHosts: "all",
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
    build: {
      sourcemap: true, // optional: helps debug Docker build issues
    },
  };
});

