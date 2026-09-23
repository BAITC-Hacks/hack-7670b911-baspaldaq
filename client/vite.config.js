import { defineConfig } from "vite";
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, projectRoot, "");
  if (!environment.VITE_API_URL) {
    throw new Error("VITE_API_URL must be set in the project .env file");
  }

  return {
    envDir: projectRoot,
    publicDir: "../public",
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        "/api": {
          target: environment.VITE_API_URL,
          changeOrigin: true,
        },
      },
    },
  };
});
