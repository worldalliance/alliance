import type { Plugin } from "vite";
import { type EnvSource, formatEnvProblems, parseEnv } from "./env";
import { NodeEnv, parseNodeEnv } from "./node-env";
import { R, type Result } from "./result";
import { type WebEnv, webEnvFields, type WebEnvKey } from "./web-env";

/** `deployedKeys`: what this app needs in a deployed build beyond the API and
 * alt-domain URLs every deployed build needs. Every build but a development
 * one needs the API URL, which `getApiUrl()` uses in every other mode. */
export function validateWebEnv(params: {
  source: EnvSource;
  mode: string;
  deployedKeys: WebEnvKey[];
}): Result<WebEnv, string[]> {
  const mode = parseNodeEnv(params.mode);
  const deployed: WebEnvKey[] = [
    "VITE_API_URL",
    "VITE_ALT_APP_URL",
    ...params.deployedKeys,
  ];
  const required: Record<NodeEnv, WebEnvKey[]> = {
    [NodeEnv.Production]: deployed,
    [NodeEnv.Staging]: deployed,
    [NodeEnv.Development]: [],
    [NodeEnv.Test]: ["VITE_API_URL"],
  };
  const env = parseEnv({
    fields: webEnvFields,
    source: params.source,
    requiredKeys: () => (mode.ok ? required[mode.value] : []),
  });
  if (mode.ok) return env;
  return R.failure([
    `mode: "${params.mode}" is not one of ${Object.values(NodeEnv).join(", ")}`,
    ...(env.ok ? [] : env.error),
  ]);
}

export function webEnvPlugin(deployedKeys: WebEnvKey[]) {
  let resolved: { mode: string; env: EnvSource } | undefined;
  return {
    name: "alliance-web-env",
    apply: "build",
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
        deployedKeys,
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
