import { R, type Result } from "@alliance/common/result";
import {
  type WebRuntimeConfig,
  webRuntimeConfigSchema,
} from "@alliance/common/web-env";
import { milliseconds } from "date-fns";
import { z } from "zod";

const CONFIG_PATH = "/config.json";
const TIMEOUT_MS = milliseconds({ seconds: 10 });

export async function fetchWebRuntimeConfig(): Promise<
  Result<WebRuntimeConfig, string>
> {
  const response = await R.fromPromise(
    // eslint-disable-next-line no-restricted-globals -- a static file nginx serves beside the panel, not the API
    fetch(CONFIG_PATH, {
      cache: "no-cache",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }),
  );
  if (!response.ok) {
    return R.failure(`${CONFIG_PATH} didn't load: ${response.error.message}`);
  }
  if (!response.value.ok) {
    return R.failure(`${CONFIG_PATH} answered ${response.value.status}`);
  }
  const body = await R.fromPromise(response.value.json());
  if (!body.ok) {
    return R.failure(`${CONFIG_PATH} isn't JSON: ${body.error.message}`);
  }
  const parsed = webRuntimeConfigSchema.safeParse(body.value);
  return parsed.success
    ? R.success(parsed.data)
    : R.failure(`${CONFIG_PATH} is invalid:\n${z.prettifyError(parsed.error)}`);
}
