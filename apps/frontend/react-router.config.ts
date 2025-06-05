import type { Config } from "@react-router/dev/config";

export default {
  appDirectory: "src",
  ssr: true,
  routeDiscovery: {
    mode: "lazy",
    manifestPath: "/__manifest",
  },
  async prerender() {
    return ["/", "/about"];
  },
} satisfies Config;
