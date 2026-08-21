import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { defineConfig } from "vite";
import {
  devPorts,
  devViteDefine,
  PortCaller,
} from "../../common/src/dev-ports";

const __dirname = path.dirname(new URL(import.meta.url).pathname);

const isStorybook =
  process.env.STORYBOOK === "true" ||
  process.argv.some((a) => a.includes("storybook"));

const monorepoRoot = path.resolve(__dirname, "..", "..");
const sharedPkg = path.resolve(monorepoRoot, "shared");
const sharedWebPkg = path.resolve(monorepoRoot, "sharedweb");
const commonPkg = path.resolve(monorepoRoot, "common");

const ports = devPorts(PortCaller.Tooling);

// https://vite.dev/config/
export default defineConfig({
  define: devViteDefine(),
  plugins: [!isStorybook && reactRouter(), tailwindcss()],
  optimizeDeps: {
    exclude: ["@alliance/shared", "@alliance/sharedweb", "@alliance/common"],
  },
  build: {
    sourcemap: "hidden",
  },
  server: {
    port: ports.frontend,
    strictPort: true,
    watch: {
      usePolling: true,
      interval: 100,
    },
    proxy: {
      "/api": {
        target: `http://localhost:${ports.server}`,
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
      "@alliance/common",
    ],
  },
  resolve: {
    preserveSymlinks: true,
    dedupe: ["react", "react-dom"],
    alias: {
      "@alliance/shared": sharedPkg,
      "@alliance/sharedweb": sharedWebPkg,
      "@alliance/common": path.join(commonPkg, "src"),
    },
  },
});
