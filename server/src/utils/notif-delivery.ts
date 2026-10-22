export function notifDeliveryEnabled(): boolean {
  return (
    process.env.NODE_ENV === "production" || process.env.SEND_DEV_NOTIFS === "1"
  );
}
