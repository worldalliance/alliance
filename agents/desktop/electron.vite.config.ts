import react from "@vitejs/plugin-react";
import { defineConfig } from "electron-vite";

export default defineConfig({
  main: {},
  // A sandboxed renderer's preload runs only as CommonJS.
  preload: {
    build: {
      rollupOptions: {
        output: { format: "cjs", entryFileNames: "[name].cjs" },
      },
    },
  },
  renderer: {
    plugins: [react()],
    // Vite's default 5173 and its fallback 5174 are the main checkout's frontend and admin ports.
    server: { port: 0 },
  },
});
