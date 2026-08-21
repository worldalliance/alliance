import { randomToken } from "src/utils/random";

export function generateCIDForNotif() {
  return randomToken(5, "hex");
}

export function generateCIDForShareUrl() {
  return "share-" + randomToken(5, "hex");
}

export enum NotificationChannel {
  Text = "text",
  Email = "email",
  Push = "push",
}
