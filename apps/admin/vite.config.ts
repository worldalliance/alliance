import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import {
  defineConfig,
  type Plugin,
  type PreviewServer,
  type ViteDevServer,
} from "vite";
import {
  devPorts,
  devViteDefine,
  PortCaller,
} from "../../common/src/dev-ports";
import { R } from "../../common/src/result";
import { webRuntimeConfigFor } from "../../common/src/web-runtime-config";

const __dirname = path.dirname(new URL(import.meta.url).pathname);

const isStorybook =
  process.env.STORYBOOK === "true" ||
  process.argv.some((a) => a.includes("storybook"));

const monorepoRoot = path.resolve(__dirname, "..", "..");
const sharedPkg = path.resolve(monorepoRoot, "shared");
const sharedWebPkg = path.resolve(monorepoRoot, "sharedweb");
const commonPkg = path.resolve(monorepoRoot, "common");

const ports = devPorts(PortCaller.Tooling);

// A deploy installs config.json for nginx to serve; dev and preview answer for it.
function serveRuntimeConfig(server: ViteDevServer | PreviewServer) {
  const body = JSON.stringify(
    R.expect(webRuntimeConfigFor(server.config.mode), "web runtime config"),
  );
  server.middlewares.use("/config.json", (_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-cache");
    res.end(body);
  });
}

const devRuntimeConfig = {
  name: "alliance-dev-runtime-config",
  apply: "serve",
  configureServer: serveRuntimeConfig,
  configurePreviewServer: serveRuntimeConfig,
} satisfies Plugin;

// https://vite.dev/config/
export default defineConfig({
  define: devViteDefine(),
  plugins: [devRuntimeConfig, !isStorybook && reactRouter(), tailwindcss()],
  optimizeDeps: {
    exclude: ["@alliance/shared", "@alliance/sharedweb", "@alliance/common"],
    include: ["style-to-js", "hast-util-to-jsx-runtime", "debug"],
  },
  server: {
    port: ports.admin,
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
  resolve: {
    preserveSymlinks: false,
    dedupe: ["react", "react-dom"],
    alias: [
      {
        find: "@alliance/shared",
        replacement: path.resolve(monorepoRoot, "shared"),
      },
      {
        find: "@alliance/sharedweb",
        replacement: path.resolve(monorepoRoot, "sharedweb"),
      },
      {
        find: "@alliance/common",
        replacement: path.join(commonPkg, "src"),
      },
    ],
  },
});
