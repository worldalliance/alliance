import { NodeEnv } from "@alliance/common/node-env";
import { env } from "../config/env";

export function notifDeliveryEnabled(): boolean {
  return env("NODE_ENV") === NodeEnv.Production || env("SEND_DEV_NOTIFS");
}

/** Why an unrecorded message did not reach its recipient. */
export enum DeliveryFailure {
  /** Sending is off or unconfigured here, the recipient can't receive it, or the message failed to render, so nothing reached the provider. */
  Unavailable = "unavailable",
  /** The provider refused it, or missed the deadline and may still deliver it. */
  Failed = "failed",
}
