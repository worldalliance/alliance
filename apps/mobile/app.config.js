const PRODUCTION_HOSTS = ["worldalliance.org", "thealliance.org"];

export const VARIANTS = {
  development: {
    name: "Alliance (Dev)",
    bundleIdentifier: "com.alliancefoundation.alliancemobile.dev",
    androidPackage: "com.alliance.alliancemobile.dev",
    googleIosClientId:
      "498109422267-oure3ds53734t8bomo4bea4fglogpg80.apps.googleusercontent.com",
    googleServicesFile: "./google-services-dev.json",
    hosts: PRODUCTION_HOSTS,
    androidAppLinks: false,
  },
  staging: {
    name: "Alliance (Staging)",
    bundleIdentifier: "com.alliancefoundation.alliancemobile.staging",
    androidPackage: "com.alliance.alliancemobile.staging",
    googleIosClientId:
      "498109422267-r8pnromvm0ns58i5dtpppu937q5s85ns.apps.googleusercontent.com",
    googleServicesFile: "./google-services-staging.json",
    hosts: ["staging.worldalliance.org", "staging.thealliance.org"],
    androidAppLinks: true,
  },
  production: {
    name: "Alliance",
    bundleIdentifier: "com.alliancefoundation.alliancemobile",
    androidPackage: "com.alliance.alliancemobile",
    googleIosClientId:
      "498109422267-a6im2d5qscd6g39nkbcvkaqp1miftvg6.apps.googleusercontent.com",
    googleServicesFile: "./google-services.json",
    hosts: PRODUCTION_HOSTS,
    androidAppLinks: true,
  },
};

const APP_VARIANT = process.env.APP_VARIANT || "production";
const VARIANT = VARIANTS[APP_VARIANT];
if (!VARIANT) {
  throw new Error(
    `APP_VARIANT=${APP_VARIANT} is not one of ${Object.keys(VARIANTS).join(", ")}`,
  );
}
// Android never reads the iOS client ID. A build server sets
// EAS_BUILD_PLATFORM; on the machine starting the build, it's unset.
if (!VARIANT.googleIosClientId && process.env.EAS_BUILD_PLATFORM === "ios") {
  throw new Error(`APP_VARIANT=${APP_VARIANT} has no Google iOS client ID`);
}

// Metro inlines `EXPO_PUBLIC_*` into the bundle, so this reaches the app while
// staying out of `extra`, which would change the fingerprint every commit and
// strand each build on its own OTA runtime version.
process.env.EXPO_PUBLIC_GIT_COMMIT ||=
  process.env.EAS_BUILD_GIT_COMMIT_HASH ?? "";

export default {
  expo: {
    name: VARIANT.name,
    slug: "alliance-mobile",
    version: "1.3.5",
    orientation: "portrait",
    icon: "./assets/images/globe-icon.png",
    scheme: "alliance",
    userInterfaceStyle: "automatic",
    owner: "alliancefoundation",
    newArchEnabled: true,
    runtimeVersion: {
      policy: "fingerprint",
    },
    updates: {
      url: "https://u.expo.dev/49c13cc4-9361-4e91-8de8-27108c7527a6",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: VARIANT.bundleIdentifier,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        // expo-apple-authentication sets this to true when it's unset.
        CFBundleAllowMixedLocalizations: false,
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: true,
        },
      },
      appleTeamId: "629G87T7R5",
      associatedDomains: VARIANT.hosts.flatMap((host) => [
        `applinks:${host}`,
        `webcredentials:${host}`,
      ]),
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/globe-icon.png",
        backgroundColor: "#000000",
      },
      package: VARIANT.androidPackage,
      // Only packages in the web app's assetlinks.json can have Android verify
      // the link and route it here. A dev build talks to a local server, which
      // answers with the alliance:// scheme instead. Both hosts, because the
      // server returns on APP_URL's.
      ...(!VARIANT.androidAppLinks
        ? {}
        : {
            intentFilters: [
              {
                action: "VIEW",
                autoVerify: true,
                category: ["BROWSABLE", "DEFAULT"],
                data: VARIANT.hosts.map((host) => ({
                  scheme: "https",
                  host,
                  path: "/mobile/oauth-callback",
                })),
              },
            ],
          }),
      googleServicesFile: VARIANT.googleServicesFile,
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/globe-icon.png",
    },
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 100,
          resizeMode: "contain",
          backgroundColor: "#ffffff",
        },
      ],
      [
        "expo-font",
        {
          fonts: [
            "./assets/fonts/SourceSans3-Regular.ttf",
            "./assets/fonts/SourceSans3-Medium.ttf",
            "./assets/fonts/SourceSans3-Semibold.ttf",
            "./assets/fonts/SourceSans3-Bold.ttf",
            "./assets/fonts/SourceSans3-Italic.ttf",
            "./assets/fonts/LibreBaskerville.ttf",
            "./assets/fonts/LibreBaskerville-Bold.ttf",
            "./assets/fonts/LibreBaskerville-SemiBold.ttf",
            "./assets/fonts/BerlingskeSerif-Blk.ttf",
          ],
        },
      ],
      [
        "expo-image-picker",
        {
          photosPermission:
            "The app accesses your photos to let you upload them when completing actions.",
          cameraPermission: false,
        },
      ],
      "expo-localization",
      "expo-secure-store",
      "expo-web-browser",
      "expo-apple-authentication",
      // Without options the plugin switches to its Firebase setup, which
      // changes the Android build too.
      ...(VARIANT.googleIosClientId
        ? [
            [
              "@react-native-google-signin/google-signin",
              {
                iosUrlScheme: `com.googleusercontent.apps.${VARIANT.googleIosClientId.split(".")[0]}`,
              },
            ],
          ]
        : []),
      [
        "expo-notifications",
        {
          icon: "./assets/images/globe-icon.png",
          color: "#000000",
        },
      ],
      "expo-video",
      [
        "expo-build-properties",
        {
          // Xcode 27 requires the UIKit scene lifecycle; SDK 58 enables it by default, so drop this there.
          ios: { enableSceneSupport: true },
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      router: {},
      googleIosClientId: VARIANT.googleIosClientId,
      eas: {
        projectId: "49c13cc4-9361-4e91-8de8-27108c7527a6",
      },
    },
  },
};
