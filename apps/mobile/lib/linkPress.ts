import { RelativePathString, router } from "expo-router";
import { useCallback } from "react";
import { Linking } from "react-native";
import { openLink } from "./openLink";

export function useHandleLinkPress() {
  return useCallback((url: string): boolean => {
    openLink(url, {
      push: (route) => router.push(route as RelativePathString),
      openURL: (target) => Linking.openURL(target),
    });
    return false;
  }, []);
}
