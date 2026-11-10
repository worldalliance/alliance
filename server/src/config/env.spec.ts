import {
  deployedConfigFor,
  developmentEnv,
} from "@alliance/common/deployed-config";
import { NodeEnv } from "@alliance/common/node-env";
import { afterEach, describe, expect, it } from "bun:test";
import { env, requireEnv, validateServerEnv } from "./env";

const base = {
  NODE_ENV: "test",
  DB_HOST: "localhost",
  DB_USERNAME: "postgres",
  DB_NAME: "alliance",
  JWT_SECRET: "jwt",
  JWT_REFRESH_SECRET: "refresh",
};

const shared = {
  DB_PASSWORD: "postgres",
  APP_URL: "https://app.example.com",
  ADMIN_URL: "https://admin.example.com",
  ASSETS_BUCKET: "bucket",
  MAIL_FROM: "Alliance <alliance@example.com>",
  SMTP_HOST: "smtp.example.com",
  SMTP_USER: "smtp",
  SMTP_PASSWORD: "smtp-password",
  MAILGUN_SIGNING_KEY: "mailgun",
  TWILIO_ACCOUNT_SID: "sid",
  TWILIO_AUTH_TOKEN: "twilio",
  TWILIO_PHONE_NUMBER: "+15550000000",
  EXPO_ACCESS_TOKEN: "expo",
  SLACK_WEBHOOK_URL: "https://hooks.example.com/slack",
  POSTHOG_KEY: "phc_test",
  POSTHOG_QUERY_KEY: "phx_test",
  POSTHOG_PROJECT_ID: "1",
  PANGRAM_API_KEY: "pangram",
  GOOGLE_CLIENT_ID: "google",
  GOOGLE_CLIENT_SECRET: "google-secret",
  APPLE_TEAM_ID: "team",
  APPLE_KEY_ID: "key",
  APPLE_SERVICES_ID: "services",
  APPLE_BUNDLE_ID: "org.example.app",
  APPLE_PRIVATE_KEY_BASE64: "a2V5",
};

const development = {
  ...base,
  ...shared,
  NODE_ENV: "development",
  ADMIN_USER: "admin@example.com",
  ADMIN_PASSWORD: "password",
  DB_PORT: "5432",
};

const deployed = {
  ...base,
  ...shared,
  NODE_ENV: "staging",
  ALT_APP_URL: "https://alt.example.com",
  ALT_ADMIN_URL: "https://admin.alt.example.com",
  DB_CA_CERT: "cert",
  CLOUDFRONT_DOMAIN: "cdn.example.com",
  NOTIF_TEST_PHONE_NUMBER: "+15550000001",
};

const production = {
  ...deployed,
  NODE_ENV: "production",
  WAITLIST_PUBLIC_MAIL_DAILY_CAP: "500",
};

const problems = (source: Record<string, string | undefined>) => {
  const result = validateServerEnv(source);
  return result.ok ? [] : result.error;
};

describe("validateServerEnv", () => {
  it("accepts the minimal test config, with typed defaults", () => {
    const result = validateServerEnv(base);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.DB_PORT).toBe(5432);
    expect(result.value.AWS_REGION).toBe("us-west-2");
    expect(result.value.SEND_DEV_NOTIFS).toBe(false);
    expect(result.value.PANGRAM_API_URL).toBe(
      "https://text.api.pangram.com/v3",
    );
  });

  it("reports every missing always-required key at once", () => {
    expect(problems({ NODE_ENV: "test", DB_HOST: "" })).toEqual([
      "DB_HOST: missing",
      "DB_USERNAME: missing",
      "DB_NAME: missing",
      "JWT_SECRET: missing",
      "JWT_REFRESH_SECRET: missing",
    ]);
  });

  it("rejects a missing or unknown NODE_ENV", () => {
    expect(problems({ ...base, NODE_ENV: undefined })).toEqual([
      "NODE_ENV: missing",
    ]);
    const [unknown] = problems({ ...base, NODE_ENV: "prod" });
    expect(unknown).toStartWith("NODE_ENV: ");
    expect(unknown).not.toBe("NODE_ENV: missing");
  });

  it("names malformed values", () => {
    const found = problems({
      ...base,
      DB_PORT: "five",
      APP_URL: "not a url",
      SEND_DEV_NOTIFS: "yes",
      WAITLIST_PUBLIC_MAIL_DAILY_CAP: "-1",
    });
    expect(found.map((line) => line.split(":")[0])).toEqual([
      "DB_PORT",
      "APP_URL",
      "SEND_DEV_NOTIFS",
      "WAITLIST_PUBLIC_MAIL_DAILY_CAP",
    ]);
    expect(found.some((line) => line.endsWith(": missing"))).toBe(false);
  });

  it("parses flags, numbers and lists", () => {
    const result = validateServerEnv({
      ...base,
      SEND_DEV_NOTIFS: "0",
      USE_CLOUDFRONT: "true",
      CLOUDFRONT_DOMAIN: "cdn.example.com",
      DB_PORT: "6543",
      APPLE_BUNDLE_ID: "a,,b",
      WAITLIST_PUBLIC_MAIL_DAILY_CAP: "500",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.SEND_DEV_NOTIFS).toBe(false);
    expect(result.value.USE_CLOUDFRONT).toBe(true);
    expect(result.value.DB_PORT).toBe(6543);
    expect(result.value.APPLE_BUNDLE_ID).toEqual(["a", "b"]);
    expect(result.value.WAITLIST_PUBLIC_MAIL_DAILY_CAP).toBe(500);
  });

  const complete = { development, staging: deployed, production };

  it("accepts a complete config in each environment", () => {
    for (const config of Object.values(complete)) {
      expect(problems(config)).toEqual([]);
    }
  });

  const committed = new Set([
    "DB_CA_CERT",
    "DB_NAME",
    "DB_PORT",
    "SEND_DEV_NOTIFS",
    "USE_CLOUDFRONT",
    "APP_URL",
    "ALT_APP_URL",
    "ADMIN_URL",
    "ALT_ADMIN_URL",
    "MAIL_FROM",
    "WAITLIST_PUBLIC_MAIL_DAILY_CAP",
    "CLOUDFRONT_DOMAIN",
    "POSTHOG_KEY",
    "POSTHOG_PROJECT_ID",
    "GOOGLE_CLIENT_ID",
    "APPLE_TEAM_ID",
    "APPLE_KEY_ID",
    "APPLE_SERVICES_ID",
    "APPLE_BUNDLE_ID",
  ]);
  const uncommitted = (config: Record<string, string>) =>
    Object.fromEntries(
      Object.entries(config).filter(([key]) =>
        config.NODE_ENV === "development"
          ? !(key in developmentEnv)
          : !committed.has(key),
      ),
    );

  it("requires each environment's keys, less what the committed config sets", () => {
    for (const [NODE_ENV, config] of Object.entries(complete)) {
      expect(problems({ ...base, NODE_ENV }).sort()).toEqual(
        Object.keys(uncommitted(config))
          .filter((key) => !(key in base))
          .map((key) => `${key}: missing`)
          .sort(),
      );
    }
  });

  it("parses each deployed environment's committed values", () => {
    const parsed = (config: Record<string, string>) => {
      const result = validateServerEnv(uncommitted(config));
      if (!result.ok) throw new Error(result.error.join("\n"));
      return result.value;
    };
    const committedFor = (nodeEnv: NodeEnv.Staging | NodeEnv.Production) => {
      const {
        DOMAIN_NAME: _,
        ALT_DOMAIN_NAME: __,
        ...rest
      } = deployedConfigFor(nodeEnv);
      return rest;
    };
    expect(parsed(deployed)).toMatchObject({
      ...committedFor(NodeEnv.Staging),
      APP_URL: "https://staging.thealliance.org",
      ALT_APP_URL: "https://staging.worldalliance.org",
      ADMIN_URL: "https://admin.staging.thealliance.org",
      ALT_ADMIN_URL: "https://admin.staging.worldalliance.org",
    });
    expect(parsed(production)).toMatchObject({
      ...committedFor(NodeEnv.Production),
      APP_URL: "https://worldalliance.org",
      ALT_APP_URL: "https://thealliance.org",
      ADMIN_URL: "https://admin.worldalliance.org",
      ALT_ADMIN_URL: "https://admin.thealliance.org",
    });
  });

  it("requires the deployed keys beside a malformed key", () => {
    const found = problems({ ...base, NODE_ENV: "staging", DB_PORT: "five" });
    expect(found[0]).toStartWith("DB_PORT: ");
    expect(found.slice(1)).toEqual(problems({ ...base, NODE_ENV: "staging" }));
  });

  it("requires no mail or Twilio config in tests, even with delivery on", () => {
    expect(problems({ ...base, SEND_DEV_NOTIFS: "1" })).toEqual([]);
  });

  it("requires a CloudFront domain when CloudFront is on", () => {
    expect(problems({ ...development, USE_CLOUDFRONT: "true" })).toEqual([
      "CLOUDFRONT_DOMAIN: missing",
    ]);
    expect(
      problems({ ...base, NODE_ENV: "prod", USE_CLOUDFRONT: "true" }),
    ).toContain("CLOUDFRONT_DOMAIN: missing");
  });

  it("treats a required empty APPLE_BUNDLE_ID list as missing", () => {
    expect(problems({ ...deployed, APPLE_BUNDLE_ID: "," })).toEqual([
      "APPLE_BUNDLE_ID: missing",
    ]);
  });
});

describe("env", () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
  });

  it("reads the value current at call time", () => {
    process.env.DB_PORT = "6000";
    expect(env("DB_PORT")).toBe(6000);
    process.env.DB_PORT = "";
    expect(env("DB_PORT")).toBe(5432);
  });

  it("applies each key's default and transform", () => {
    delete process.env.AWS_REGION;
    delete process.env.PANGRAM_API_URL;
    process.env.APPLE_BUNDLE_ID = "a,,b";
    process.env.USE_CLOUDFRONT = "true";
    expect(env("AWS_REGION")).toBe("us-west-2");
    expect(env("PANGRAM_API_URL")).toBe("https://text.api.pangram.com/v3");
    expect(env("APPLE_BUNDLE_ID")).toEqual(["a", "b"]);
    expect(env("USE_CLOUDFRONT")).toBe(true);
    process.env.PANGRAM_API_URL = " https://pangram.example ";
    expect(env("PANGRAM_API_URL")).toBe("https://pangram.example");
    process.env.PANGRAM_API_URL = "   ";
    expect(env("PANGRAM_API_URL")).toBe("https://text.api.pangram.com/v3");
  });

  it("throws naming a malformed key", () => {
    process.env.DB_PORT = "x";
    expect(() => env("DB_PORT")).toThrow("DB_PORT");
  });

  it("rejects a URL without an http(s) scheme", () => {
    process.env.APP_URL = "localhost:7273";
    expect(() => env("APP_URL")).toThrow(/APP_URL: (?!missing)/);
    process.env.APP_URL = "http://localhost:7273";
    expect(env("APP_URL")).toBe("http://localhost:7273");
  });

  it("requireEnv throws on an unset optional key", () => {
    delete process.env.MAIL_FROM;
    expect(() => requireEnv("MAIL_FROM")).toThrow("MAIL_FROM: missing");
    process.env.MAIL_FROM = "Alliance <a@example.com>";
    expect(requireEnv("MAIL_FROM")).toBe("Alliance <a@example.com>");
  });

  it("falls back to the committed config in a deployed environment", () => {
    const committed = deployedConfigFor(NodeEnv.Production);
    process.env = { NODE_ENV: "production", DB_NAME: "" };
    expect(env("APP_URL")).toBe(`https://${committed.DOMAIN_NAME}`);
    expect(env("DB_NAME")).toBe(committed.DB_NAME);
    expect(env("WAITLIST_PUBLIC_MAIL_DAILY_CAP")).toBe(
      committed.WAITLIST_PUBLIC_MAIL_DAILY_CAP,
    );
    expect(env("APPLE_BUNDLE_ID")).toEqual(committed.APPLE_BUNDLE_ID);
    expect(env("DB_CA_CERT")).toStartWith("-----BEGIN CERTIFICATE-----");
    process.env.DB_NAME = "alliance_sync";
    expect(env("DB_NAME")).toBe("alliance_sync");
    process.env.NODE_ENV = "development";
    expect(env("APP_URL")).toBeUndefined();
  });
});
