const IS_DEV = process.env.APP_VARIANT === "development";

// OAuth client ids from the Google Cloud console; public by design. The web
// client is the server's audience, so both native SDKs name it as their
// server client. The iOS client id also becomes the URL scheme Google's SDK
// returns through, reversed.
const GOOGLE_WEB_CLIENT_ID =
  "498109422267-jla0nu3g91hpj838dj54di7hd09dmjgv.apps.googleusercontent.com";
const GOOGLE_IOS_CLIENT_ID = IS_DEV
  ? "498109422267-oure3ds53734t8bomo4bea4fglogpg80.apps.googleusercontent.com"
  : "498109422267-a6im2d5qscd6g39nkbcvkaqp1miftvg6.apps.googleusercontent.com";
const GOOGLE_IOS_URL_SCHEME = `com.googleusercontent.apps.${GOOGLE_IOS_CLIENT_ID.split(".")[0]}`;

// Metro inlines `EXPO_PUBLIC_*` into the bundle, so this reaches the app while
// staying out of `extra`, which would change the fingerprint every commit and
// strand each build on its own OTA runtime version.
process.env.EXPO_PUBLIC_GIT_COMMIT ||=
  process.env.EAS_BUILD_GIT_COMMIT_HASH ?? "";

export default {
  expo: {
    name: IS_DEV ? "Alliance (Dev)" : "Alliance",
    slug: "alliance-mobile",
    version: "1.3.2",
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
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: true,
        },
      },
      appleTeamId: "629G87T7R5",
      usesAppleSignIn: true,
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
      [
        "expo-notifications",
        {
          icon: "./assets/images/globe-icon.png",
          color: "#000000",
        },
      ],
      "expo-video",
      "expo-apple-authentication",
      [
        "@react-native-google-signin/google-signin",
        { iosUrlScheme: GOOGLE_IOS_URL_SCHEME },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      oauth: {
        googleWebClientId: GOOGLE_WEB_CLIENT_ID,
        googleIosClientId: GOOGLE_IOS_CLIENT_ID,
      },
      router: {},
      eas: {
        projectId: "49c13cc4-9361-4e91-8de8-27108c7527a6",
      },
    },
  },
};
