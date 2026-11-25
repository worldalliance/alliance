import type { Route } from "../fake-gh";

export const COMMIT = "c".repeat(40);
export const NEWER = "d".repeat(40);

export const deployments = (
  environment: string,
  ...entries: [id: number, sha: string][]
): Route => ({
  match: `/deployments?environment=${environment}&`,
  response: entries.map(([id, sha]) => ({ id, sha })),
});
