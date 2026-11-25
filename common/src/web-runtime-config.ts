import { deployedConfigFor } from "./deployed-config";
import { parseNodeEnv } from "./node-env";
import { R, type Result } from "./result";
import { type WebRuntimeConfig, webRuntimeConfigSchema } from "./web-env";
import { describeSchemaIssues } from "./zod-issues";

/** The runtime config a web app serves in `mode`, from the committed deployed
 * config. Development and test carry only their environment and run without
 * PostHog: development reads its URLs from the dev ports, and a test supplies
 * its own. */
export function webRuntimeConfigFor(
  mode: string | undefined,
): Result<WebRuntimeConfig, string[]> {
  const nodeEnv = parseNodeEnv(mode);
  if (!nodeEnv.ok) return R.failure([nodeEnv.error.message]);
  const environment = nodeEnv.value;
  const config = deployedConfigFor(environment);
  const parsed = webRuntimeConfigSchema.safeParse(
    config
      ? {
          environment,
          VITE_API_URL: `https://${config.DOMAIN_NAME}`,
          VITE_ALT_APP_URL: `https://${config.ALT_DOMAIN_NAME}`,
          VITE_PUBLIC_POSTHOG_KEY: config.POSTHOG_KEY,
          VITE_PUBLIC_POSTHOG_HOST: `https://${config.DOMAIN_NAME}/events/`,
        }
      : { environment },
  );
  return parsed.success
    ? R.success(parsed.data)
    : R.failure(describeSchemaIssues(parsed.error));
}
