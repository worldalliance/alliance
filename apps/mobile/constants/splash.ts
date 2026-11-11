import type { ReloadScreenOptions } from "expo-updates";
import { type ImageRequireSource } from "react-native";

// Mirrors the expo-splash-screen options in app.config.js; the screens that
// stand in for the splash only read as it while these match.
export const SPLASH_IMAGE: ImageRequireSource = require("../assets/images/splash-icon.png");
export const SPLASH_BACKGROUND_COLOR = "#ffffff";
export const SPLASH_IMAGE_WIDTH = 100;

// Reloading into an update shows the splash stand-in, so the restart reads as
// one continuous launch rather than a flash of white.
export const SPLASH_RELOAD_SCREEN: ReloadScreenOptions = {
  backgroundColor: SPLASH_BACKGROUND_COLOR,
  image: SPLASH_IMAGE,
  imageResizeMode: "contain",
  fade: true,
};
