import {
  deployedConfigEnv,
  deployedConfigFor,
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
import { type Result } from "@alliance/common/result";
import { z } from "zod";

const text = z.string();
const positiveInt = z.coerce.number().int().positive();

const fields = {
  NODE_ENV: required(z.enum(NodeEnv)),

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

function committedEnv(nodeEnv: NodeEnv): Partial<Record<ServerEnvKey, string>> {
  const config = deployedConfigFor(nodeEnv);
  if (!config) return {};
  const { DOMAIN_NAME, ALT_DOMAIN_NAME, ...committed } =
    deployedConfigEnv(config);
  return {
    ...committed,
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

/** Reads `process.env` on every call, so a value a test sets is seen. In
 * staging and production, the committed config fills what it leaves unset. */
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

// ADMIN_USER and ADMIN_PASSWORD are in Infisical but the deploy never hands
// them to the server, which reads them only outside production.
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

// The keys Infisical's `alliance` project or the committed config sets in the
// matching environment, flags aside; test has no Infisical environment.
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
    "AWS_REGION",
    "DB_PASSWORD",
    "DB_PORT",
    "EXPO_ACCESS_TOKEN",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "MAIL_FROM",
    "MAILGUN_SIGNING_KEY",
    "PANGRAM_API_KEY",
    "PANGRAM_API_URL",
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

// An invalid NODE_ENV is reported on its own, and leaves what it would
// require unknown.
function conditionallyRequired(config: Partial<ServerEnv>): ServerEnvKey[] {
  const cloudfront = config.USE_CLOUDFRONT
    ? (["CLOUDFRONT_DOMAIN"] as const)
    : [];
  const nodeEnv = config.NODE_ENV;
  if (nodeEnv === undefined) return [...cloudfront];
  return [
    ...setFor[nodeEnv],
    // The committed config sets the URLs, and the deploy the bucket.
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
  return parseEnv({
    fields,
    source: withCommitted(source),
    requiredKeys: conditionallyRequired,
  });
}
