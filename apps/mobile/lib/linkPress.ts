import { RelativePathString, router } from "expo-router";
import { useCallback } from "react";
import { Linking } from "react-native";
import { getSitePageUrl } from "./config";
import { internalRouteFor } from "./internalLinks";

export function useHandleLinkPress() {
  return useCallback((url: string): boolean => {
    const internalRoute = internalRouteFor(url);
    if (internalRoute) {
      router.push(internalRoute as RelativePathString);
      return false; // Prevent default handling
    }

    // For external URLs, open in browser
    if (url.startsWith("http://") || url.startsWith("https://")) {
      Linking.openURL(url).catch((err) => {
        console.error("Failed to open URL:", err);
      });
      return false;
    }

    // For mailto: and other protocols
    if (url.includes(":")) {
      Linking.openURL(url).catch((err) => {
        console.error("Failed to open URL:", err);
      });
      return false;
    }

    // For relative URLs that don't match internal routes, open on web
    Linking.openURL(getSitePageUrl(url)).catch((err) => {
      console.error("Failed to open URL:", err);
    });
    return false;
  }, []);
}
