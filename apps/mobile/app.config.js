const IS_DEV = process.env.APP_VARIANT === "development";

export default {
  expo: {
    name: IS_DEV ? "Alliance (Dev)" : "Alliance",
    slug: "alliance-mobile",
    version: "1.3.1",
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
      associatedDomains: [
        "applinks:worldalliance.org",
        "webcredentials:worldalliance.org",
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
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: "49c13cc4-9361-4e91-8de8-27108c7527a6",
      },
    },
  },
};
