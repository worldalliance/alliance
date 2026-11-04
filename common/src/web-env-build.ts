import path from "node:path";
import { loadEnv, type Plugin, type UserConfig } from "vite";
import { deployedConfigFor } from "./deployed-config";
import {
  type EnvSource,
  envWithFallback,
  formatEnvProblems,
  parseEnv,
} from "./env";
import { NodeEnv, parseNodeEnv } from "./node-env";
import { R, type Result } from "./result";
import { type WebEnv, webEnvFields, type WebEnvKey } from "./web-env";

const committedWebKeys = [
  "VITE_API_URL",
  "VITE_ALT_APP_URL",
  "VITE_PUBLIC_POSTHOG_KEY",
  "VITE_PUBLIC_POSTHOG_HOST",
] as const satisfies WebEnvKey[];

function committedWebEnv(
  mode: string,
): Record<(typeof committedWebKeys)[number], string> | Record<string, never> {
  const nodeEnv = parseNodeEnv(mode);
  const config = nodeEnv.ok ? deployedConfigFor(nodeEnv.value) : undefined;
  if (!config) return {};
  return {
    VITE_API_URL: `https://${config.DOMAIN_NAME}`,
    VITE_ALT_APP_URL: `https://${config.ALT_DOMAIN_NAME}`,
    VITE_PUBLIC_POSTHOG_KEY: config.POSTHOG_KEY,
    VITE_PUBLIC_POSTHOG_HOST: `https://${config.DOMAIN_NAME}/events/`,
  };
}

function withCommittedWebEnv(params: {
  source: EnvSource;
  mode: string;
}): EnvSource {
  return envWithFallback({
    source: params.source,
    fallback: committedWebEnv(params.mode),
  });
}

/** Every build but a development one needs the API URL, which `getApiUrl()`
 * uses in every other mode. A deployed build requires each committed value, so
 * a blank one fails the build. */
export function validateWebEnv(params: {
  source: EnvSource;
  mode: string;
}): Result<WebEnv, string[]> {
  const mode = parseNodeEnv(params.mode);
  const required: Record<NodeEnv, readonly WebEnvKey[]> = {
    [NodeEnv.Production]: committedWebKeys,
    [NodeEnv.Staging]: committedWebKeys,
    [NodeEnv.Development]: [],
    [NodeEnv.Test]: ["VITE_API_URL"],
  };
  const env = parseEnv({
    fields: webEnvFields,
    source: withCommittedWebEnv(params),
    requiredKeys: () => (mode.ok ? required[mode.value] : []),
  });
  if (mode.ok) return env;
  return R.failure([
    `mode: "${params.mode}" is not one of ${Object.values(NodeEnv).join(", ")}`,
    ...(env.ok ? [] : env.error),
  ]);
}

export function webEnvPlugin() {
  let resolved: { mode: string; env: EnvSource } | undefined;
  return {
    name: "alliance-web-env",
    apply: "build",
    // Resolved here and defined key by key, so a bundle carries only its own
    // environment's strings, never the committed config. Read from Vite's env
    // dir, so a value from a `.env` file or the environment wins.
    config(user: UserConfig, { mode }: { mode: string }) {
      const envDir =
        user.envDir === false
          ? false
          : path.resolve(user.root ?? "", user.envDir ?? "");
      const env = withCommittedWebEnv({ source: loadEnv(mode, envDir), mode });
      const define = Object.keys(committedWebEnv(mode)).map((key) => [
        `import.meta.env.${key}`,
        JSON.stringify(env[key]),
      ]);
      return { define: Object.fromEntries(define) };
    },
    configResolved(config: { mode: string; env: EnvSource }) {
      resolved = config;
    },
    // Tools that only resolve the config, such as `react-router typegen`,
    // never call buildStart, so they run without deploy values.
    buildStart(this: void) {
      if (!resolved) throw new Error("web-env: config was never resolved");
      const result = validateWebEnv({
        source: resolved.env,
        mode: resolved.mode,
      });
      if (result.ok) return;
      throw new Error(
        formatEnvProblems({
          heading: `Invalid environment for a ${resolved.mode} build`,
          problems: result.error,
        }),
      );
    },
  } satisfies Plugin;
}
