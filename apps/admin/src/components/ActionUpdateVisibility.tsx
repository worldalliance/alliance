import { run } from "@alliance/common/run";
import type { AdminActionUpdateDto } from "@alliance/shared/client";
import { Eye, EyeOff } from "lucide-react";

enum VisibilityState {
  Unpublished = "unpublished",
  Scheduled = "scheduled",
  Published = "published",
}

type Visibility =
  | { state: VisibilityState.Unpublished }
  | { state: VisibilityState.Scheduled; visibleAt: Date }
  | { state: VisibilityState.Published; visibleAt: Date };

const visibilityOf = (
  update: AdminActionUpdateDto,
  now: number,
): Visibility => {
  if (!update.visibleAt) return { state: VisibilityState.Unpublished };

  const visibleAt = new Date(update.visibleAt);
  return visibleAt.getTime() > now
    ? { state: VisibilityState.Scheduled, visibleAt }
    : { state: VisibilityState.Published, visibleAt };
};

const hiddenMessageOf = (visibility: Visibility): string | null => {
  switch (visibility.state) {
    case VisibilityState.Unpublished:
      return "Not visible to members yet — this update publishes the first time you save content on the Content tab, or at its displayed date if that is later.";
    case VisibilityState.Scheduled:
      return `Not visible to members yet — this update publishes ${visibility.visibleAt.toLocaleString()}.`;
    case VisibilityState.Published:
      return null;
    default:
      throw new Error(`unknown visibility: ${visibility satisfies never}`);
  }
};

export function HiddenFromMembersBanner({
  update,
}: {
  update: AdminActionUpdateDto;
}) {
  const message = hiddenMessageOf(visibilityOf(update, Date.now()));
  if (!message) return null;
  return (
    <div className="mx-5 mt-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
      <EyeOff className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
      <p className="text-sm">{message}</p>
    </div>
  );
}

export function VisibilityControls({
  update,
  hasUnsavedDetails,
  changing,
  onPublishNow,
  onUnpublish,
}: {
  update: AdminActionUpdateDto;
  hasUnsavedDetails: boolean;
  changing: boolean;
  onPublishNow: () => void;
  onUnpublish: () => void;
}) {
  const now = Date.now();
  const visibility = visibilityOf(update, now);

  switch (visibility.state) {
    case VisibilityState.Unpublished:
      return (
        <p className="text-sm text-gray-700">
          Not published yet — this update publishes the first time you save
          content on the Content tab, or at its displayed date if that is later.
        </p>
      );
    case VisibilityState.Scheduled:
      return (
        <>
          <p className="text-sm text-gray-700">
            Hidden from members until {visibility.visibleAt.toLocaleString()},
            when it publishes on its own.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onPublishNow}
              disabled={changing}
              className="flex items-center gap-2 px-4 py-2 bg-green text-white rounded-md hover:scale-102 transition-all duration-200 text-sm font-medium disabled:opacity-50 disabled:hover:scale-100"
            >
              <Eye className="w-4 h-4" aria-hidden />
              {changing ? "Publishing..." : "Publish now"}
            </button>
            <p className="text-xs text-gray-500">
              Makes the update visible to members immediately.
            </p>
          </div>
        </>
      );
    case VisibilityState.Published: {
      const displayDate = new Date(update.date);
      // Unpublishing moves `visibleAt` to the saved date, so an unsaved edit to
      // the picker would schedule the update for a different time than the one
      // shown.
      const unpublishBlockedReason = run(() => {
        if (hasUnsavedDetails) {
          return "Save your changes first.";
        }
        if (displayDate.getTime() <= now) {
          return "The displayed date has already passed, so there's nothing to wait for.";
        }
        return null;
      });
      return (
        <>
          <p className="text-sm text-gray-700">
            Visible to members since {visibility.visibleAt.toLocaleString()}.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onUnpublish}
              disabled={changing || unpublishBlockedReason !== null}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-md hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-50 disabled:hover:bg-white"
            >
              <EyeOff className="w-4 h-4" aria-hidden />
              {changing ? "Unpublishing..." : "Unpublish until displayed date"}
            </button>
            <p className="text-xs text-gray-500">
              {unpublishBlockedReason ??
                `Hides it from members until ${displayDate.toLocaleString()}.`}
            </p>
          </div>
        </>
      );
    }
    default:
      throw new Error(`unknown visibility: ${visibility satisfies never}`);
  }
}
