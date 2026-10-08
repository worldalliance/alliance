import { randomToken } from "src/utils/random";

export function generateCIDForShareUrl() {
  return "share-" + generateCIDForExternalTarget();
}

export function generateCIDForExternalTarget() {
  return randomToken(5, "hex");
}

export enum NotificationChannel {
  Text = "text",
  Email = "email",
  Push = "push",
}
