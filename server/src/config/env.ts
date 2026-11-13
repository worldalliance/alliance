import {
  deployedConfigEnv,
  deployedConfigFor,
  developmentEnv,
} from "@alliance/common/deployed-config";
import {
  envWithFallback,
  envFlag as flag,
  optionalEnv as optional,
  parseEnv,
  readEnvKey,
  requiredEnv as required,
  requireEnvKey,
  httpUrl as url,
} from "@alliance/common/env";
import { isDeployed, NodeEnv } from "@alliance/common/node-env";
import { R, type Result } from "@alliance/common/result";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

const text = z.string();
const positiveInt = z.coerce.number().int().positive();

const fields = {
  NODE_ENV: required(z.enum(NodeEnv)),
  ALLIANCE_WITHOUT_TEAM_SECRETS: flag,

  DB_HOST: required(text),
  DB_PORT: optional(z.coerce.number().int().min(1).max(65535)).transform(
    (port) => port ?? 5432,
  ),
  DB_USERNAME: required(text),
  DB_PASSWORD: optional(text),
  DB_NAME: required(text),
  TEST_DB_NAME: optional(text),
  DB_CA_CERT: optional(text),

  JWT_SECRET: required(text),
  JWT_REFRESH_SECRET: required(text),

  APP_URL: optional(url),
  ALT_APP_URL: optional(url),
  ADMIN_URL: optional(url),
  ALT_ADMIN_URL: optional(url),

  ADMIN_USER: optional(text),
  ADMIN_PASSWORD: optional(text),

  SEND_DEV_NOTIFS: flag,
  NOTIF_TEST_PHONE_NUMBER: optional(text),
  MAIL_FROM: optional(text),
  SMTP_HOST: optional(text),
  SMTP_USER: optional(text),
  SMTP_PASSWORD: optional(text),
  MAILGUN_SIGNING_KEY: optional(text),
  WAITLIST_PUBLIC_MAIL_DAILY_CAP: optional(positiveInt),
  TWILIO_ACCOUNT_SID: optional(text),
  TWILIO_AUTH_TOKEN: optional(text),
  TWILIO_PHONE_NUMBER: optional(text),
  EXPO_ACCESS_TOKEN: optional(text),
  SLACK_WEBHOOK_URL: optional(url),

  AWS_REGION: optional(text).transform((region) => region ?? "us-west-2"),
  ASSETS_BUCKET: optional(text),
  USE_CLOUDFRONT: flag,
  CLOUDFRONT_DOMAIN: optional(text),

  POSTHOG_KEY: optional(text),
  POSTHOG_QUERY_KEY: optional(text),
  POSTHOG_PROJECT_ID: optional(text),
  DEV_POSTHOG_ANALYTICS: flag,

  PANGRAM_API_KEY: optional(z.string().trim()),
  PANGRAM_API_URL: optional(z.string().trim().pipe(url)).transform(
    (endpoint) => endpoint ?? "https://text.api.pangram.com/v3",
  ),
  USE_DEV_AI_DETECTION: flag,

  GOOGLE_CLIENT_ID: optional(text),
  GOOGLE_CLIENT_SECRET: optional(text),
  APPLE_TEAM_ID: optional(text),
  APPLE_KEY_ID: optional(text),
  APPLE_SERVICES_ID: optional(text),
  APPLE_BUNDLE_ID: optional(
    text.transform((ids) => ids.split(",").filter(Boolean)),
  ),
  APPLE_PRIVATE_KEY_BASE64: optional(text),
};

export type ServerEnvKey = keyof typeof fields;
export type ServerEnv = z.output<z.ZodObject<typeof fields>>;

// AWS's public CA bundle for RDS in us-west-2, from
// https://truststore.pki.rds.amazonaws.com/us-west-2/us-west-2-bundle.pem
const rdsCaBundle = readFileSync(
  join(__dirname, "rds-us-west-2-bundle.pem"),
  "utf8",
);

// A plain annotation skips excess-key checks on a named object, so a
// misspelled developmentEnv key would compile and be ignored.
const developmentCommitted: {
  [K in keyof typeof developmentEnv]: K extends ServerEnvKey ? string : never;
} = developmentEnv;

export function committedEnv(
  nodeEnv: NodeEnv,
): Partial<Record<ServerEnvKey, string>> {
  if (nodeEnv === NodeEnv.Development) return developmentCommitted;
  const config = deployedConfigFor(nodeEnv);
  if (!config) return {};
  const { DOMAIN_NAME, ALT_DOMAIN_NAME, ...committed } =
    deployedConfigEnv(config);
  return {
    ...committed,
    DB_CA_CERT: rdsCaBundle,
    APP_URL: `https://${DOMAIN_NAME}`,
    ALT_APP_URL: `https://${ALT_DOMAIN_NAME}`,
    ADMIN_URL: `https://admin.${DOMAIN_NAME}`,
    ALT_ADMIN_URL: `https://admin.${ALT_DOMAIN_NAME}`,
  };
}

const committedByEnv = new Map<
  string | undefined,
  Partial<Record<ServerEnvKey, string>>
>(Object.values(NodeEnv).map((nodeEnv) => [nodeEnv, committedEnv(nodeEnv)]));

const withCommitted = (source: Record<string, string | undefined>) =>
  envWithFallback({
    source,
    fallback: committedByEnv.get(source.NODE_ENV) ?? {},
  });

// Merges only the key read, since env() sits on per-row paths.
const committedSource = (key: ServerEnvKey) =>
  envWithFallback({
    source: { [key]: process.env[key] },
    fallback: { [key]: committedByEnv.get(process.env.NODE_ENV)?.[key] },
  });

/** Reads `process.env` on every call, so a value a test sets is seen. Outside
 * tests, the committed config fills what it leaves unset. */
export function env<K extends ServerEnvKey>(
  key: K,
): z.output<(typeof fields)[K]> {
  return readEnvKey({ fields, key, source: committedSource(key) });
}

/** For a key that is optional overall but required where it's called. */
export function requireEnv<K extends ServerEnvKey>(
  key: K,
): NonNullable<z.output<(typeof fields)[K]>> {
  return requireEnvKey({ fields, key, source: committedSource(key) });
}

export function notifDeliveryEnabledFor(
  config: Pick<ServerEnv, "NODE_ENV" | "SEND_DEV_NOTIFS">,
): boolean {
  return config.NODE_ENV === NodeEnv.Production || config.SEND_DEV_NOTIFS;
}

export function deliverySendsFor(
  config: Pick<ServerEnv, "NODE_ENV" | "SEND_DEV_NOTIFS">,
): boolean {
  return config.NODE_ENV !== NodeEnv.Test && notifDeliveryEnabledFor(config);
}

export function twilioSignatureEnforcedFor(nodeEnv: NodeEnv): boolean {
  return isDeployed(nodeEnv);
}

const deployedSet = [
  "APPLE_BUNDLE_ID",
  "APPLE_KEY_ID",
  "APPLE_PRIVATE_KEY_BASE64",
  "APPLE_SERVICES_ID",
  "APPLE_TEAM_ID",
  "CLOUDFRONT_DOMAIN",
  "DB_CA_CERT",
  "DB_PASSWORD",
  "EXPO_ACCESS_TOKEN",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "MAIL_FROM",
  "MAILGUN_SIGNING_KEY",
  "NOTIF_TEST_PHONE_NUMBER",
  "PANGRAM_API_KEY",
  "POSTHOG_KEY",
  "POSTHOG_PROJECT_ID",
  "POSTHOG_QUERY_KEY",
  "SLACK_WEBHOOK_URL",
  "SMTP_HOST",
  "SMTP_PASSWORD",
  "SMTP_USER",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_PHONE_NUMBER",
] as const satisfies ServerEnvKey[];

// Which keys /alliance/staging/server/ and /alliance/prod/server/ may hold:
// never committed config, NODE_ENV (secrets_run.sh refuses to override it), dev
// and test keys, or keys whose schema defaults suffice; ADMIN_USER there would
// seed an admin on staging.
const inDeployedStore: Record<ServerEnvKey, boolean> = {
  NODE_ENV: false,
  ALLIANCE_WITHOUT_TEAM_SECRETS: false,
  DB_HOST: true,
  DB_PORT: false,
  DB_USERNAME: true,
  DB_PASSWORD: true,
  DB_NAME: false,
  TEST_DB_NAME: false,
  DB_CA_CERT: false,
  JWT_SECRET: true,
  JWT_REFRESH_SECRET: true,
  APP_URL: false,
  ALT_APP_URL: false,
  ADMIN_URL: false,
  ALT_ADMIN_URL: false,
  ADMIN_USER: false,
  ADMIN_PASSWORD: false,
  SEND_DEV_NOTIFS: false,
  NOTIF_TEST_PHONE_NUMBER: true,
  MAIL_FROM: false,
  SMTP_HOST: true,
  SMTP_USER: true,
  SMTP_PASSWORD: true,
  MAILGUN_SIGNING_KEY: true,
  WAITLIST_PUBLIC_MAIL_DAILY_CAP: false,
  TWILIO_ACCOUNT_SID: true,
  TWILIO_AUTH_TOKEN: true,
  TWILIO_PHONE_NUMBER: true,
  EXPO_ACCESS_TOKEN: true,
  SLACK_WEBHOOK_URL: true,
  AWS_REGION: false,
  ASSETS_BUCKET: true,
  USE_CLOUDFRONT: false,
  CLOUDFRONT_DOMAIN: false,
  POSTHOG_KEY: false,
  POSTHOG_QUERY_KEY: true,
  POSTHOG_PROJECT_ID: false,
  DEV_POSTHOG_ANALYTICS: false,
  PANGRAM_API_KEY: true,
  PANGRAM_API_URL: false,
  USE_DEV_AI_DETECTION: false,
  GOOGLE_CLIENT_ID: false,
  GOOGLE_CLIENT_SECRET: true,
  APPLE_TEAM_ID: false,
  APPLE_KEY_ID: false,
  APPLE_SERVICES_ID: false,
  APPLE_BUNDLE_ID: false,
  APPLE_PRIVATE_KEY_BASE64: true,
};

export const deployedStoreKeys = Object.entries(inDeployedStore).flatMap(
  ([key, allowed]) => (allowed ? [key] : []),
);

// The keys the committed config, a checkout's own server/.env or Parameter
// Store sets, flags aside; test has no store.
const setFor: Record<NodeEnv, readonly ServerEnvKey[]> = {
  [NodeEnv.Development]: [
    "ADMIN_PASSWORD",
    "ADMIN_URL",
    "ADMIN_USER",
    "APP_URL",
    "APPLE_BUNDLE_ID",
    "APPLE_KEY_ID",
    "APPLE_PRIVATE_KEY_BASE64",
    "APPLE_SERVICES_ID",
    "APPLE_TEAM_ID",
    "ASSETS_BUCKET",
    "DB_PASSWORD",
    "DB_PORT",
    "EXPO_ACCESS_TOKEN",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "MAIL_FROM",
    "MAILGUN_SIGNING_KEY",
    "PANGRAM_API_KEY",
    "POSTHOG_KEY",
    "POSTHOG_PROJECT_ID",
    "POSTHOG_QUERY_KEY",
    "SLACK_WEBHOOK_URL",
    "SMTP_HOST",
    "SMTP_PASSWORD",
    "SMTP_USER",
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_PHONE_NUMBER",
  ],
  [NodeEnv.Staging]: deployedSet,
  [NodeEnv.Production]: [...deployedSet, "WAITLIST_PUBLIC_MAIL_DAILY_CAP"],
  [NodeEnv.Test]: [],
};

// What ALLIANCE_WITHOUT_TEAM_SECRETS stops development requiring: the keys in
// /alliance/dev/server/ besides the JWT secrets and the seeded admin, which a
// contributor generates.
export const teamOnlyKeys: ReadonlySet<ServerEnvKey> = new Set([
  "APPLE_PRIVATE_KEY_BASE64",
  "EXPO_ACCESS_TOKEN",
  "GOOGLE_CLIENT_SECRET",
  "MAILGUN_SIGNING_KEY",
  "PANGRAM_API_KEY",
  "POSTHOG_QUERY_KEY",
  "SLACK_WEBHOOK_URL",
  "SMTP_PASSWORD",
  "SMTP_USER",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_PHONE_NUMBER",
]);

const allowsWithoutTeamSecrets: Record<NodeEnv, boolean> = {
  [NodeEnv.Development]: true,
  [NodeEnv.Staging]: false,
  [NodeEnv.Production]: false,
  [NodeEnv.Test]: false,
};

export function withoutTeamSecrets(
  config: Partial<
    Pick<ServerEnv, "NODE_ENV" | "ALLIANCE_WITHOUT_TEAM_SECRETS">
  >,
): boolean {
  return (
    config.NODE_ENV !== undefined &&
    allowsWithoutTeamSecrets[config.NODE_ENV] &&
    config.ALLIANCE_WITHOUT_TEAM_SECRETS === true
  );
}

export function unsetTeamOnlyKeys(config: ServerEnv): ServerEnvKey[] {
  if (!withoutTeamSecrets(config)) return [];
  return [...teamOnlyKeys].filter((key) => config[key] === undefined).sort();
}

// An invalid NODE_ENV is reported on its own, and leaves what it would
// require unknown.
function conditionallyRequired(config: Partial<ServerEnv>): ServerEnvKey[] {
  const cloudfront = config.USE_CLOUDFRONT
    ? (["CLOUDFRONT_DOMAIN"] as const)
    : [];
  const nodeEnv = config.NODE_ENV;
  if (nodeEnv === undefined) return [...cloudfront];
  const dropped = withoutTeamSecrets(config) ? teamOnlyKeys : new Set();
  return [
    ...setFor[nodeEnv].filter((key) => !dropped.has(key)),
    // The committed config sets the URLs, and Parameter Store the bucket.
    ...(isDeployed(nodeEnv)
      ? ([
          "APP_URL",
          "ALT_APP_URL",
          "ADMIN_URL",
          "ALT_ADMIN_URL",
          "ASSETS_BUCKET",
        ] as const)
      : []),
    ...(twilioSignatureEnforcedFor(nodeEnv)
      ? (["TWILIO_AUTH_TOKEN", "APP_URL"] as const)
      : []),
    // The Mailgun webhook builds a PostHog client in every NODE_ENV but test.
    ...(nodeEnv !== NodeEnv.Test ? (["POSTHOG_KEY"] as const) : []),
    ...(deliverySendsFor({
      NODE_ENV: nodeEnv,
      SEND_DEV_NOTIFS: config.SEND_DEV_NOTIFS ?? false,
    })
      ? ([
          "MAIL_FROM",
          "SMTP_HOST",
          "SMTP_USER",
          "SMTP_PASSWORD",
          "TWILIO_ACCOUNT_SID",
          "TWILIO_AUTH_TOKEN",
          "TWILIO_PHONE_NUMBER",
        ] as const)
      : []),
    ...cloudfront,
  ];
}

export function validateServerEnv(
  source: Record<string, string | undefined> = process.env,
): Result<ServerEnv, string[]> {
  return R.flatMap(
    parseEnv({
      fields,
      source: withCommitted(source),
      requiredKeys: conditionallyRequired,
    }),
    (config) =>
      config.ALLIANCE_WITHOUT_TEAM_SECRETS &&
      !allowsWithoutTeamSecrets[config.NODE_ENV]
        ? R.failure([
            `ALLIANCE_WITHOUT_TEAM_SECRETS: only for development, not ${config.NODE_ENV}`,
          ])
        : R.success(config),
  );
}
