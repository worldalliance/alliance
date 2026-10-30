export function notifDeliveryEnabled(): boolean {
  return (
    process.env.NODE_ENV === "production" || process.env.SEND_DEV_NOTIFS === "1"
  );
}

/** Why an unrecorded message did not reach its recipient. */
export enum DeliveryFailure {
  /** Sending is off or unconfigured here, the recipient can't receive it, or the message failed to render, so nothing reached the provider. */
  Unavailable = "unavailable",
  /** The provider refused it, or missed the deadline and may still deliver it. */
  Failed = "failed",
}
