import { NodeEnv } from "./node-env";
import { ALLIANCE_LEGACY_DOMAIN, isLegacyAllianceHost } from "./url";

type DeployedNodeEnv = NodeEnv.Staging | NodeEnv.Production;

// The repo is public: only values that grant no access on their own belong
// here. The backends read their secrets from AWS SSM Parameter Store.
export type DeployedConfig = {
  DOMAIN_NAME: string;
  ALT_DOMAIN_NAME: string;
  DB_NAME: string;
  DB_PORT: number;
  APPLE_TEAM_ID: string;
  APPLE_KEY_ID: string;
  APPLE_SERVICES_ID: string;
  APPLE_BUNDLE_ID: string[];
  GOOGLE_CLIENT_ID: string;
  MAIL_FROM: string;
  SEND_DEV_NOTIFS: boolean;
  WAITLIST_PUBLIC_MAIL_DAILY_CAP: number | undefined;
  USE_CLOUDFRONT: boolean;
  CLOUDFRONT_DOMAIN: string;
  POSTHOG_KEY: string;
  POSTHOG_PROJECT_ID: string;
};

const shared = {
  DB_NAME: "alliance",
  DB_PORT: 5432,
  APPLE_TEAM_ID: "629G87T7R5",
  APPLE_KEY_ID: "T32B4D3S84",
  APPLE_SERVICES_ID: "org.thealliance.signin",
  GOOGLE_CLIENT_ID:
    "498109422267-jla0nu3g91hpj838dj54di7hd09dmjgv.apps.googleusercontent.com",
  MAIL_FROM: "Alliance <alliance@thealliance.org>",
  USE_CLOUDFRONT: true,
} satisfies Partial<DeployedConfig>;

const deployedConfig: {
  [E in NodeEnv]: E extends DeployedNodeEnv ? DeployedConfig : undefined;
} = {
  [NodeEnv.Staging]: {
    ...shared,
    DOMAIN_NAME: "staging.thealliance.org",
    ALT_DOMAIN_NAME: "staging.worldalliance.org",
    APPLE_BUNDLE_ID: [
      "com.alliancefoundation.alliancemobile",
      "com.alliancefoundation.alliancemobile.dev",
      "com.alliancefoundation.alliancemobile.staging",
    ],
    SEND_DEV_NOTIFS: true,
    WAITLIST_PUBLIC_MAIL_DAILY_CAP: undefined,
    CLOUDFRONT_DOMAIN: "d1dzp7yye3nwsb.cloudfront.net",
    POSTHOG_KEY: "phc_Af7iQMRPzZS1T0MkYp20WgXyThUnWkNChHuYhuxomPS",
    POSTHOG_PROJECT_ID: "232423",
  },
  [NodeEnv.Production]: {
    ...shared,
    DOMAIN_NAME: "worldalliance.org",
    ALT_DOMAIN_NAME: "thealliance.org",
    APPLE_BUNDLE_ID: [
      "com.alliancefoundation.alliancemobile",
      "com.alliancefoundation.alliancemobile.dev",
    ],
    SEND_DEV_NOTIFS: false,
    WAITLIST_PUBLIC_MAIL_DAILY_CAP: 500,
    CLOUDFRONT_DOMAIN: "dj92mxbdjuclo.cloudfront.net",
    POSTHOG_KEY: "phc_4Bkir1Px9qIRnMQfMWQPcGIq6wjodf9jtme8fty3ZLt",
    POSTHOG_PROJECT_ID: "188181",
  },
  [NodeEnv.Development]: undefined,
  [NodeEnv.Test]: undefined,
};

export enum DomainMove {
  /** Only invite links and the public pages leave the legacy domain. */
  OptIn = "opt-in",
  /** Every page load leaves the legacy domain. */
  CutOver = "cut-over",
}

/**
 * The legacy domain is whichever of the two is on {@link ALLIANCE_LEGACY_DOMAIN},
 * so swapping `DOMAIN_NAME` and `ALT_DOMAIN_NAME` is what cuts an environment
 * over. `DOMAIN_NAME` names the TLS certificate lineages and the API host.
 */
export function domainMove(
  config: Pick<DeployedConfig, "DOMAIN_NAME" | "ALT_DOMAIN_NAME">,
): { move: DomainMove; legacyDomain: string; newDomain: string } {
  const { DOMAIN_NAME, ALT_DOMAIN_NAME } = config;
  const legacy = [DOMAIN_NAME, ALT_DOMAIN_NAME].filter(isLegacyAllianceHost);
  if (legacy.length !== 1) {
    throw new Error(
      `exactly one of ${DOMAIN_NAME} and ${ALT_DOMAIN_NAME} must be on ${ALLIANCE_LEGACY_DOMAIN}`,
    );
  }
  return legacy[0] === ALT_DOMAIN_NAME
    ? {
        move: DomainMove.CutOver,
        legacyDomain: ALT_DOMAIN_NAME,
        newDomain: DOMAIN_NAME,
      }
    : {
        move: DomainMove.OptIn,
        legacyDomain: DOMAIN_NAME,
        newDomain: ALT_DOMAIN_NAME,
      };
}

export function deployedConfigFor<E extends NodeEnv>(
  nodeEnv: E,
): (typeof deployedConfig)[E] {
  return deployedConfig[nodeEnv];
}

/** DOMAIN_NAME and ALT_DOMAIN_NAME have no server env key of their own. */
export function deployedConfigEnv(
  config: DeployedConfig,
): Record<keyof DeployedConfig, string | undefined> {
  return {
    DOMAIN_NAME: config.DOMAIN_NAME,
    ALT_DOMAIN_NAME: config.ALT_DOMAIN_NAME,
    DB_NAME: config.DB_NAME,
    DB_PORT: String(config.DB_PORT),
    APPLE_TEAM_ID: config.APPLE_TEAM_ID,
    APPLE_KEY_ID: config.APPLE_KEY_ID,
    APPLE_SERVICES_ID: config.APPLE_SERVICES_ID,
    APPLE_BUNDLE_ID: config.APPLE_BUNDLE_ID.join(","),
    GOOGLE_CLIENT_ID: config.GOOGLE_CLIENT_ID,
    MAIL_FROM: config.MAIL_FROM,
    SEND_DEV_NOTIFS: String(config.SEND_DEV_NOTIFS),
    WAITLIST_PUBLIC_MAIL_DAILY_CAP:
      config.WAITLIST_PUBLIC_MAIL_DAILY_CAP?.toString(),
    USE_CLOUDFRONT: String(config.USE_CLOUDFRONT),
    CLOUDFRONT_DOMAIN: config.CLOUDFRONT_DOMAIN,
    POSTHOG_KEY: config.POSTHOG_KEY,
    POSTHOG_PROJECT_ID: config.POSTHOG_PROJECT_ID,
  };
}
