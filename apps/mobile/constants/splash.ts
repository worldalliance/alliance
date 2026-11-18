import type { ReloadScreenOptions } from "expo-updates";

// Mirrors the expo-splash-screen options in app.config.js, so reloading into an
// update reads as one continuous launch rather than a flash of white.
export const SPLASH_RELOAD_SCREEN: ReloadScreenOptions = {
  backgroundColor: "#ffffff",
  image: require("../assets/images/splash-icon.png"),
  imageResizeMode: "contain",
  fade: true,
};
