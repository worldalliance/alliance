import { browserUrlFor } from "./config";
import { internalRouteFor } from "./internalLinks";

export function openLink(
  url: string,
  open: {
    push: (route: string) => void;
    openURL: (url: string) => Promise<unknown>;
  },
): void {
  const internalRoute = internalRouteFor(url);
  if (internalRoute) {
    open.push(internalRoute);
    return;
  }
  open.openURL(browserUrlFor(url)).catch((err) => {
    console.error("Failed to open URL:", err);
  });
}
