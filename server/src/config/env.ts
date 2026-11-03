import {
  envFlag as flag,
  optionalEnv as optional,
  readEnvKey,
  requiredEnv as required,
  requireEnvKey,
  httpUrl as url,
} from "@alliance/common/env";
import { NodeEnv } from "@alliance/common/node-env";
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

/** Reads `process.env` on every call, so a value a test sets is seen. */
export function env<K extends ServerEnvKey>(
  key: K,
): z.output<(typeof fields)[K]> {
  return readEnvKey({ fields, key, source: process.env });
}

/** For a key that is optional overall but required where it's called. */
export function requireEnv<K extends ServerEnvKey>(
  key: K,
): NonNullable<z.output<(typeof fields)[K]>> {
  return requireEnvKey({ fields, key, source: process.env });
}
