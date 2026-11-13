import { requireEnv } from "../config/env";

export function assetsBucket(): string {
  return requireEnv("ASSETS_BUCKET");
}
