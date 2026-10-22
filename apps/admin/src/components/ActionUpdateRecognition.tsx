export const COLLECTIVE_RESULT_DESCRIPTION =
  "Every member reads this as written, after “Update: ” in pushes and texts.";

export function NotificationHeldBanner({ reason }: { reason: string }) {
  return (
    <div
      className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
      role="alert"
    >
      <p className="font-medium">
        This update&apos;s notifications are on hold.
      </p>
      <p>{reason}</p>
      <p className="mt-1 text-xs">
        Fix the copy and save; they go out within a minute.
      </p>
    </div>
  );
}
