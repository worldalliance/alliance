const IS_DEV = process.env.APP_VARIANT === "development";

// Metro inlines `EXPO_PUBLIC_*` into the bundle, so this reaches the app while
// staying out of `extra`, which would change the fingerprint every commit and
// strand each build on its own OTA runtime version.
process.env.EXPO_PUBLIC_GIT_COMMIT ||=
  process.env.EAS_BUILD_GIT_COMMIT_HASH ?? "";

const GOOGLE_IOS_CLIENT_ID = IS_DEV
  ? "498109422267-oure3ds53734t8bomo4bea4fglogpg80.apps.googleusercontent.com"
  : "498109422267-a6im2d5qscd6g39nkbcvkaqp1miftvg6.apps.googleusercontent.com";

export default {
  expo: {
    name: IS_DEV ? "Alliance (Dev)" : "Alliance",
    slug: "alliance-mobile",
    version: "1.3.4",
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
      bundleIdentifier: IS_DEV
        ? "com.alliancefoundation.alliancemobile.dev"
        : "com.alliancefoundation.alliancemobile",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        // expo-apple-authentication sets this to true when it's unset.
        CFBundleAllowMixedLocalizations: false,
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: true,
        },
      },
      appleTeamId: "629G87T7R5",
      associatedDomains: [
        "applinks:worldalliance.org",
        "webcredentials:worldalliance.org",
        "applinks:thealliance.org",
        "webcredentials:thealliance.org",
      ],
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/globe-icon.png",
        backgroundColor: "#000000",
      },
      package: IS_DEV
        ? "com.alliance.alliancemobile.dev"
        : "com.alliance.alliancemobile",
      // Only the production package is in the web app's assetlinks.json, so
      // only it can have Android verify the link and route it here. A dev
      // build talks to a local server, which answers with the alliance://
      // scheme instead. Both hosts, because the server returns on APP_URL's.
      ...(IS_DEV
        ? {}
        : {
            intentFilters: [
              {
                action: "VIEW",
                autoVerify: true,
                category: ["BROWSABLE", "DEFAULT"],
                data: ["worldalliance.org", "thealliance.org"].map((host) => ({
                  scheme: "https",
                  host,
                  path: "/mobile/oauth-callback",
                })),
              },
            ],
          }),
      googleServicesFile: IS_DEV
        ? "./google-services-dev.json"
        : "./google-services.json",
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
      [
        "@react-native-google-signin/google-signin",
        {
          iosUrlScheme: `com.googleusercontent.apps.${GOOGLE_IOS_CLIENT_ID.split(".")[0]}`,
        },
      ],
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
      googleIosClientId: GOOGLE_IOS_CLIENT_ID,
      eas: {
        projectId: "49c13cc4-9361-4e91-8de8-27108c7527a6",
      },
    },
  },
};
