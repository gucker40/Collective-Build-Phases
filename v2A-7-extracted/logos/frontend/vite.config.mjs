import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const isWeb = process.env.VITE_MODE === "web";

export default defineConfig({
  plugins: [react()],
  // Web mode: absolute paths from root so FastAPI can serve correctly
  // Electron mode: relative paths for local file:// loading
  base: isWeb ? "/" : "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    host: true,
  },
  define: {
    __VITE_WEB_MODE__: JSON.stringify(isWeb ? "web" : "electron"),
  },
});
