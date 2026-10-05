import { NodeEnv } from "@alliance/common/node-env";
import { expect, it } from "bun:test";
import { ANDROID_PACKAGE, oauthReturnAndroidPackage } from "./mobileApp";

it("returns staging sign-ins to the staging app", () => {
  expect(oauthReturnAndroidPackage(NodeEnv.Staging)).toBe(
    "com.alliance.alliancemobile.staging",
  );
});

it("returns other sign-ins to the store app", () => {
  expect(oauthReturnAndroidPackage(NodeEnv.Production)).toBe(ANDROID_PACKAGE);
});
