import { NodeEnv } from "@alliance/common/node-env";

export const ANDROID_PACKAGE = "com.alliance.alliancemobile";

/** The app that starts a mobile sign-in against a deployment built in `mode`. */
export const oauthReturnAndroidPackage = (mode: string): string =>
  mode === NodeEnv.Staging ? `${ANDROID_PACKAGE}.staging` : ANDROID_PACKAGE;
