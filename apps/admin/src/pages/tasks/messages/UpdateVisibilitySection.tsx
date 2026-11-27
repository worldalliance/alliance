import { run } from "@alliance/common/run";
import type { AdminActionUpdateDto } from "@alliance/shared/client";
import { Eye, EyeOff } from "lucide-react";
import Button, { ButtonVariant } from "../../../ui/Button";
import InlineError from "../../../ui/InlineError";
import { Banner, BannerTone } from "../../../ui/templates/Banner";
import { FormSection } from "../../../ui/templates/Form";
import {
  hiddenNoticeOf,
  pacific,
  visibilityOf,
  VisibilityState,
} from "./updateRules";

export function HiddenFromMembersBanner({
  update,
}: {
  update: Pick<AdminActionUpdateDto, "visibleAt">;
}) {
  const notice = hiddenNoticeOf(visibilityOf(update, new Date()));
  return notice && <Banner tone={BannerTone.Warning}>{notice}</Banner>;
}

/**
 * Publish now sets `visibleAt` to now; Unpublish moves it to the saved
 * date and moves the notification entries with it
 * (`server/src/actions/action-updates.service.ts`,
 * `publishActionUpdateNow`, `unpublishActionUpdateUntilDate`).
 */
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
  const now = new Date();
  const visibility = visibilityOf(update, now);
  switch (visibility.state) {
    case VisibilityState.Unpublished:
      return (
        <p>
          Not published yet. The first save of its content on the Content tab
          publishes it, at once or at its date if that is later.
        </p>
      );
    case VisibilityState.Scheduled: {
      // Publishing refills the form from the server's copy.
      const blocked = hasUnsavedDetails ? "Save your changes first." : null;
      return (
        <>
          <p>
            Hidden from members until {pacific(visibility.visibleAt)}, when it
            publishes on its own.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant={ButtonVariant.Default}
              busy={changing}
              disabled={blocked !== null}
              onClick={onPublishNow}
            >
              <Eye aria-hidden className="size-4" />
              Publish now
            </Button>
            <p className="text-fg-muted">
              {blocked ??
                "Members who can see the task see the update at once."}
            </p>
          </div>
        </>
      );
    }
    case VisibilityState.Published: {
      const date = new Date(update.date);
      // Unpublishing moves `visibleAt` to the saved date, so an unsaved edit to
      // the picker would schedule the update for a different time than the one
      // shown.
      const blocked = run(() => {
        if (hasUnsavedDetails) return "Save your changes first.";
        if (date <= now) {
          return "The displayed date has already passed, so there's nothing to wait for.";
        }
        return null;
      });
      return (
        <>
          <p>
            Published since {pacific(visibility.visibleAt)}, to everyone who can
            see the task.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant={ButtonVariant.Default}
              busy={changing}
              disabled={blocked !== null}
              onClick={onUnpublish}
            >
              <EyeOff aria-hidden className="size-4" />
              Unpublish until displayed date
            </Button>
            <p className="text-fg-muted">
              {blocked ?? `Hides it from members until ${pacific(date)}.`}
            </p>
          </div>
        </>
      );
    }
    default:
      throw new Error(`unknown visibility: ${visibility satisfies never}`);
  }
}

export function UpdateVisibilitySection(
  props: Parameters<typeof VisibilityControls>[0] & { refusal: string | null },
) {
  return (
    <FormSection title="Member visibility">
      <VisibilityControls {...props} />
      <InlineError message={props.refusal} />
    </FormSection>
  );
}
