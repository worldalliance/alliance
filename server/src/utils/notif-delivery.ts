import { deliverySendsFor, env, notifDeliveryEnabledFor } from "../config/env";

export function notifDeliveryEnabled(): boolean {
  return notifDeliveryEnabledFor({
    NODE_ENV: env("NODE_ENV"),
    SEND_DEV_NOTIFS: env("SEND_DEV_NOTIFS"),
  });
}

/** False under test even with SEND_DEV_NOTIFS set, so specs never reach Mailgun or Twilio. */
export function deliverySends(): boolean {
  return deliverySendsFor({
    NODE_ENV: env("NODE_ENV"),
    SEND_DEV_NOTIFS: env("SEND_DEV_NOTIFS"),
  });
}

/** Why an unrecorded message did not reach its recipient. */
export enum DeliveryFailure {
  /** Sending is off or unconfigured here, the recipient can't receive it, or the message failed to render, so nothing reached the provider. */
  Unavailable = "unavailable",
  /** The provider refused it, or missed the deadline and may still deliver it. */
  Failed = "failed",
}
