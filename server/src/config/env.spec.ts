import { afterEach, describe, expect, it } from "bun:test";
import { env, requireEnv } from "./env";

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
});
