import { describe, expect, test } from "bun:test";
import {
  deployedConfigEnv,
  deployedConfigFor,
  domainMove,
} from "./deployed-config";
import { isDeployed, NodeEnv } from "./node-env";

describe("deployedConfigFor", () => {
  test("has a config for exactly the deployed environments", () => {
    for (const nodeEnv of Object.values(NodeEnv)) {
      expect(deployedConfigFor(nodeEnv) !== undefined).toBe(
        isDeployed(nodeEnv),
      );
    }
  });
});

describe("deployedConfigEnv", () => {
  test("renders each value as the env string the server parses", () => {
    const config = deployedConfigFor(NodeEnv.Staging);
    expect(
      deployedConfigEnv({
        ...config,
        APPLE_BUNDLE_ID: ["a.b", "c.d"],
        DB_PORT: 5432,
        SEND_DEV_NOTIFS: false,
        USE_CLOUDFRONT: true,
        WAITLIST_PUBLIC_MAIL_DAILY_CAP: 500,
      }),
    ).toMatchObject({
      DOMAIN_NAME: config.DOMAIN_NAME,
      APPLE_BUNDLE_ID: "a.b,c.d",
      DB_PORT: "5432",
      SEND_DEV_NOTIFS: "false",
      USE_CLOUDFRONT: "true",
      WAITLIST_PUBLIC_MAIL_DAILY_CAP: "500",
    });
    expect(
      deployedConfigEnv({
        ...config,
        WAITLIST_PUBLIC_MAIL_DAILY_CAP: undefined,
      }).WAITLIST_PUBLIC_MAIL_DAILY_CAP,
    ).toBeUndefined();
  });
});

describe("domainMove", () => {
  test("both environments have cut over", () => {
    expect(domainMove(deployedConfigFor(NodeEnv.Staging))).toEqual({
      legacyDomain: "staging.worldalliance.org",
      newDomain: "staging.thealliance.org",
    });
    expect(domainMove(deployedConfigFor(NodeEnv.Production))).toEqual({
      legacyDomain: "worldalliance.org",
      newDomain: "thealliance.org",
    });
  });

  test("throws unless ALT_DOMAIN_NAME alone is legacy", () => {
    for (const [DOMAIN_NAME, ALT_DOMAIN_NAME] of [
      ["worldalliance.org", "thealliance.org"],
      ["thealliance.org", "staging.thealliance.org"],
      ["worldalliance.org", "staging.worldalliance.org"],
    ]) {
      expect(() => domainMove({ DOMAIN_NAME, ALT_DOMAIN_NAME })).toThrow(
        "must be on",
      );
    }
  });
});
