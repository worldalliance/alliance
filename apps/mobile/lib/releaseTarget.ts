import { NodeEnv } from "@alliance/common/node-env";
import { R, type Result } from "@alliance/common/result";

/** Mirrors the `VARIANTS` keys in app.config.js. */
export enum AppVariant {
  Development = "development",
  Staging = "staging",
  Production = "production",
}

/** The iOS bundle ID and Android package of each variant in app.config.js. */
export const APPLICATION_IDS: Record<AppVariant, readonly string[]> = {
  [AppVariant.Development]: [
    "com.alliancefoundation.alliancemobile.dev",
    "com.alliance.alliancemobile.dev",
  ],
  [AppVariant.Staging]: [
    "com.alliancefoundation.alliancemobile.staging",
    "com.alliance.alliancemobile.staging",
  ],
  [AppVariant.Production]: [
    "com.alliancefoundation.alliancemobile",
    "com.alliance.alliancemobile",
  ],
};

export type ReleaseTarget = {
  apiUrl: string;
  env: NodeEnv;
  posthog: { apiKey: string; host: string };
};

const PRODUCTION: ReleaseTarget = {
  apiUrl: "https://worldalliance.org/api",
  env: NodeEnv.Production,
  posthog: {
    apiKey: "phc_4Bkir1Px9qIRnMQfMWQPcGIq6wjodf9jtme8fty3ZLt",
    host: "https://worldalliance.org/events/",
  },
};

// A dev build running a published update has no local server to reach.
const RELEASE_TARGETS: Record<AppVariant, ReleaseTarget> = {
  [AppVariant.Development]: PRODUCTION,
  [AppVariant.Staging]: {
    apiUrl: "https://staging.worldalliance.org/api",
    env: NodeEnv.Staging,
    posthog: {
      apiKey: "phc_Af7iQMRPzZS1T0MkYp20WgXyThUnWkNChHuYhuxomPS",
      host: "https://staging.worldalliance.org/events/",
    },
  },
  [AppVariant.Production]: PRODUCTION,
};

// Keyed on the installed binary, not an `EXPO_PUBLIC_` variable: Metro's
// transform cache keeps an inlined value that app.config.js changed, so a bundle
// could carry another variant's.
export function releaseTargetFor(
  applicationId: string | null,
): Result<ReleaseTarget, Error> {
  const variant = Object.values(AppVariant).find(
    (v) => applicationId !== null && APPLICATION_IDS[v].includes(applicationId),
  );
  return variant
    ? R.success(RELEASE_TARGETS[variant])
    : R.failure(
        new Error(
          `${applicationId ?? "<no application ID>"} is not an Alliance app`,
        ),
      );
}
