import { NodeEnv } from "@alliance/common/node-env";
import { describe, expect, it } from "bun:test";
import { VARIANTS } from "../app.config";
import { APPLICATION_IDS, AppVariant, releaseTargetFor } from "./releaseTarget";

describe("releaseTargetFor", () => {
  it.each(Object.values(AppVariant))(
    "knows the %s app's IDs from app.config.js",
    (variant) => {
      const { bundleIdentifier, androidPackage } = VARIANTS[variant];

      expect(APPLICATION_IDS[variant]).toEqual([
        bundleIdentifier,
        androidPackage,
      ]);
    },
  );

  it.each([...APPLICATION_IDS[AppVariant.Staging]])(
    "points %s at staging",
    (applicationId) => {
      const target = releaseTargetFor(applicationId);

      expect(target.ok && target.value).toMatchObject({
        apiUrl: "https://staging.worldalliance.org/api",
        env: NodeEnv.Staging,
        posthog: { host: "https://staging.worldalliance.org/events/" },
      });
    },
  );

  it.each([
    ...APPLICATION_IDS[AppVariant.Production],
    ...APPLICATION_IDS[AppVariant.Development],
  ])("points %s at production", (applicationId) => {
    const target = releaseTargetFor(applicationId);

    expect(target.ok && target.value).toMatchObject({
      apiUrl: "https://worldalliance.org/api",
      env: NodeEnv.Production,
    });
  });

  it.each([null, "", "com.example.other"])("refuses %p", (applicationId) => {
    expect(releaseTargetFor(applicationId).ok).toBe(false);
  });
});
