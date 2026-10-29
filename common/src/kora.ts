import { NodeEnv, parseNodeEnv } from "./node-env";

export const KORA_PROJECT_PATH = "/projects/safer-chatbots-for-children";

/** The `error` field of a refused Kora participant request, for clients to branch on. */
export enum KoraError {
  SignupExpired = "kora_signup_expired",
}

/** The one launch switch for the project page and the Kora participant API. */
const KORA_AVAILABLE: Record<NodeEnv, boolean> = {
  [NodeEnv.Production]: false,
  [NodeEnv.Staging]: true,
  [NodeEnv.Development]: true,
  [NodeEnv.Test]: true,
};

export function koraAvailable(env: string | undefined): boolean {
  const parsed = parseNodeEnv(env);
  return parsed.ok && KORA_AVAILABLE[parsed.value];
}
