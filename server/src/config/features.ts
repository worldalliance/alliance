import { type Features, isEnabled } from "@alliance/common/features";
import { env } from "./env";

export const isFeatureEnabled = (feature: Features): boolean =>
  isEnabled(feature, env("NODE_ENV"));
