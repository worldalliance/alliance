import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { defineConfig } from "vite";

const __dirname = path.dirname(new URL(import.meta.url).pathname);

const isStorybook =
  process.env.STORYBOOK === "true" ||
  process.argv.some((a) => a.includes("storybook"));

const monorepoRoot = path.resolve(__dirname, "..", "..");
const sharedPkg = path.resolve(monorepoRoot, "shared");
const sharedWebPkg = path.resolve(monorepoRoot, "sharedweb");

// https://vite.dev/config/
export default defineConfig({
  plugins: [!isStorybook && reactRouter(), tailwindcss()],
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(
      process.env.VITE_APP_VERSION || process.env.APP_VERSION || "dev"
    ),
  },
  optimizeDeps: {
    exclude: ["@alliance/shared", "@alliance/sharedweb"],
  },
  build: {
    sourcemap: "hidden",
  },
  server: {
    watch: {
      usePolling: true,
      interval: 100,
    },
    proxy: {
      "/api": {
        target: "http://localhost:3005",
        changeOrigin: true,
        secure: false,
      },
    },
    fs: {
      allow: [monorepoRoot, sharedPkg, sharedWebPkg],
    },
  },
  ssr: {
    noExternal: [
      "posthog-js",
      "posthog-js/react",
      "@alliance/shared",
      "@alliance/sharedweb",
    ],
  },
  resolve: {
    preserveSymlinks: true,
    dedupe: ["react", "react-dom"],
    alias: {
      "@alliance/shared": sharedPkg,
      "@alliance/shared/*": path.join(sharedPkg, "/*"),
      "@alliance/sharedweb": sharedWebPkg,
      "@alliance/sharedweb/*": path.join(sharedWebPkg, "/*"),
    },
  },
});
