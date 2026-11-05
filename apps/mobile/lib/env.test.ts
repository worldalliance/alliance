import { setEnv } from "@alliance/common/set-env";
import { afterEach, expect, it } from "bun:test";
import { mobileEnv, type MobileEnvKey } from "./env";

const samples = {
  EXPO_PUBLIC_ALLIANCE_API_PORT: { raw: "4321", read: 4321 },
  EXPO_PUBLIC_DEV_API_URL: { raw: "dev-api", read: "dev-api" },
  EXPO_PUBLIC_GIT_COMMIT: { raw: "abc123", read: "abc123" },
  EXPO_PUBLIC_DEV_AUTO_LOGIN: { raw: "1", read: true },
  EXPO_PUBLIC_DEV_EMAIL: { raw: "dev@example.test", read: "dev@example.test" },
  EXPO_PUBLIC_DEV_PASSWORD: { raw: "dev-password", read: "dev-password" },
  EXPO_PUBLIC_VISUAL_TEST: { raw: "true", read: true },
  EXPO_PUBLIC_VISUAL_TEST_API_URL: {
    raw: "https://visual.test",
    read: "https://visual.test",
  },
  EXPO_PUBLIC_VISUAL_TEST_EMAIL: {
    raw: "visual@example.test",
    read: "visual@example.test",
  },
  EXPO_PUBLIC_VISUAL_TEST_PASSWORD: {
    raw: "visual-password",
    read: "visual-password",
  },
} satisfies Record<MobileEnvKey, { raw: string; read: unknown }>;
const keys = Object.keys(samples).filter(
  (key): key is MobileEnvKey => key in samples,
);
const original = Object.fromEntries(keys.map((k) => [k, process.env[k]]));

afterEach(() => {
  for (const key of keys) setEnv(key, original[key]);
});

it("reads each key from its own variable", () => {
  for (const key of keys) {
    for (const other of keys) delete process.env[other];
    process.env[key] = samples[key].raw;

    expect(mobileEnv(key)).toEqual(samples[key].read);
    for (const other of keys) {
      if (other !== key) {
        expect(mobileEnv(other)).not.toEqual(samples[other].read);
      }
    }
  }
});

it.each([
  ["EXPO_PUBLIC_ALLIANCE_API_PORT", "0"],
  ["EXPO_PUBLIC_ALLIANCE_API_PORT", "65536"],
  ["EXPO_PUBLIC_ALLIANCE_API_PORT", "80.5"],
  ["EXPO_PUBLIC_ALLIANCE_API_PORT", "abc"],
  ["EXPO_PUBLIC_VISUAL_TEST_API_URL", "not a url"],
  ["EXPO_PUBLIC_VISUAL_TEST_API_URL", "localhost:4005"],
  ["EXPO_PUBLIC_VISUAL_TEST", "yes"],
  ["EXPO_PUBLIC_DEV_AUTO_LOGIN", "yes"],
] as const)("rejects %s=%p naming the key", (key, raw) => {
  process.env[key] = raw;
  expect(() => mobileEnv(key)).toThrow(
    new RegExp(`^Invalid environment: ${key}: (?!missing)`),
  );
});

it("reads the dev credentials only under __DEV__", () => {
  process.env.EXPO_PUBLIC_DEV_EMAIL = "dev@example.test";
  process.env.EXPO_PUBLIC_DEV_PASSWORD = "dev-password";
  Object.assign(globalThis, { __DEV__: false });
  try {
    expect(mobileEnv("EXPO_PUBLIC_DEV_EMAIL")).toBeUndefined();
    expect(mobileEnv("EXPO_PUBLIC_DEV_PASSWORD")).toBeUndefined();
  } finally {
    Object.assign(globalThis, { __DEV__: true });
  }
});
