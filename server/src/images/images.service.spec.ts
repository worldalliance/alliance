import { afterEach, describe, expect, it } from "bun:test";
import { getImageSource } from "./images.service";

const KEY = "1762925939234-8f14e45f.webp";

describe("getImageSource when deployed", () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
  });

  const deployed = (vars: Record<string, string>) => {
    const {
      USE_CLOUDFRONT: _flag,
      CLOUDFRONT_DOMAIN: _domain,
      ...rest
    } = original;
    process.env = {
      ...rest,
      NODE_ENV: "staging",
      APP_URL: "https://app.example.org",
      ...vars,
    };
  };

  it.each(["true", "1"])(
    "serves from CloudFront when the flag is %p",
    (flag) => {
      deployed({ USE_CLOUDFRONT: flag, CLOUDFRONT_DOMAIN: "cdn.example.org" });
      expect(getImageSource(KEY)).toBe(`https://cdn.example.org/${KEY}`);
    },
  );

  it("throws when CloudFront is on without a domain", () => {
    deployed({ USE_CLOUDFRONT: "true" });
    expect(() => getImageSource(KEY)).toThrow("CLOUDFRONT_DOMAIN: missing");
  });

  it("throws on an unrecognized flag value", () => {
    deployed({ USE_CLOUDFRONT: "yes", CLOUDFRONT_DOMAIN: "cdn.example.org" });
    expect(() => getImageSource(KEY)).toThrow("USE_CLOUDFRONT");
  });

  it.each(["", "0", "false"])(
    "serves through the API when the flag is %p",
    (flag) => {
      deployed({ USE_CLOUDFRONT: flag });
      expect(getImageSource(KEY)).toBe(
        `https://app.example.org/api/images/${KEY}`,
      );
    },
  );
});
