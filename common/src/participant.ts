import { NodeEnv, parseNodeEnv } from "./node-env";

/** The one launch switch for the project page and the participant API. */
const PARTICIPANTS_AVAILABLE: Record<NodeEnv, boolean> = {
  [NodeEnv.Production]: false,
  [NodeEnv.Staging]: true,
  [NodeEnv.Development]: true,
  [NodeEnv.Test]: true,
};

export function participantsAvailable(env: string | undefined): boolean {
  const parsed = parseNodeEnv(env);
  return parsed.ok && PARTICIPANTS_AVAILABLE[parsed.value];
}
