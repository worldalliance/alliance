import { deployedConfigFor } from "@alliance/common/deployed-config";
import { NodeEnv } from "@alliance/common/node-env";
import { S3Client } from "@aws-sdk/client-s3";
import { ServiceUnavailableException } from "@nestjs/common";
import { afterEach, describe, expect, it } from "bun:test";
import { getImageSource, ImagesService } from "./images.service";

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

  it("throws on an unrecognized flag value", () => {
    deployed({ USE_CLOUDFRONT: "yes", CLOUDFRONT_DOMAIN: "cdn.example.org" });
    expect(() => getImageSource(KEY)).toThrow("USE_CLOUDFRONT");
  });

  it("serves from the committed CloudFront domain when the flag is unset", () => {
    deployed({});
    expect(getImageSource(KEY)).toBe(
      `https://${deployedConfigFor(NodeEnv.Staging).CLOUDFRONT_DOMAIN}/${KEY}`,
    );
  });

  it.each(["0", "false"])(
    "serves through the API when the flag is %p",
    (flag) => {
      deployed({ USE_CLOUDFRONT: flag });
      expect(getImageSource(KEY)).toBe(
        `https://app.example.org/api/images/${KEY}`,
      );
    },
  );
});

describe("without the team's secrets", () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
  });
  const service = () => {
    process.env = {
      ...original,
      NODE_ENV: "development",
      ALLIANCE_WITHOUT_TEAM_SECRETS: "1",
    };
    return new ImagesService(new S3Client({}));
  };
  const png =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

  it("answers 503 to an upload", async () => {
    await expect(service().uploadImage(png)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it("answers 503 to a jpeg download", async () => {
    await expect(
      service().jpegDownload({
        key: KEY,
        requester: "requester",
        clientGone: () => false,
      }),
    ).rejects.toThrow(ServiceUnavailableException);
  });
});
