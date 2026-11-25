import { NodeEnv } from "@alliance/common/node-env";

export const ANDROID_PACKAGE = "com.alliance.alliancemobile";

const oauthReturnAndroidPackages: Record<NodeEnv, string> = {
  [NodeEnv.Production]: ANDROID_PACKAGE,
  [NodeEnv.Staging]: `${ANDROID_PACKAGE}.staging`,
  [NodeEnv.Development]: ANDROID_PACKAGE,
  [NodeEnv.Test]: ANDROID_PACKAGE,
};

/** The app that starts a mobile sign-in against the `environment` deployment. */
export const oauthReturnAndroidPackage = (environment: NodeEnv): string =>
  oauthReturnAndroidPackages[environment];
