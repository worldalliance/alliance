import { defineConfig } from "@hey-api/openapi-ts";
import { devApiUrl } from "../common/src/dev-ports";

/** Hey API resolves output paths from the caller's working directory. */
export function defineAllianceApiConfig(params: {
  output: string;
  runtimeConfigPath: string;
}) {
  return defineConfig({
    input: `${devApiUrl()}/openapi.yaml`,
    output: params.output,
    plugins: [
      {
        name: "@hey-api/client-fetch",
        runtimeConfigPath: params.runtimeConfigPath,
      },
    ],
  });
}
