import { defineConfig } from "vite";
import path from "node:path";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
import tailwindcss from "@tailwindcss/vite";
import { reactRouter } from "@react-router/dev/vite";

const isStorybook =
  process.env.STORYBOOK === "true" ||
  process.argv.some((a) => a.includes("storybook"));

// https://vite.dev/config/
export default defineConfig({
  plugins: [!isStorybook && reactRouter(), tailwindcss()],
  ssr: {
    noExternal: ["posthog-js", "posthog-js/react"],
  },
  resolve: {
    preserveSymlinks: true,
    alias: [
      {
        find: "three/webgpu",
        replacement: path.resolve(
          __dirname,
          "../../node_modules/globe.gl/node_modules/three/build/three.webgpu.js"
        ),
      },
      {
        find: "three/tsl",
        replacement: path.resolve(
          __dirname,
          "../../node_modules/globe.gl/node_modules/three/build/three.tsl.js"
        ),
      },
      {
        find: "three",
        replacement: path.resolve(
          __dirname,
          "../../node_modules/globe.gl/node_modules/three"
        ),
      },
    ],
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3005",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
