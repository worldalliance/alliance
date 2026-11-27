import type { AdminActionUpdateDto } from "@alliance/shared/client";
import { max } from "date-fns";
import { Send } from "lucide-react";
import { useState } from "react";
import { usesRecognition } from "../../../lib/actionUpdateDetails";
import { adminRefusalMessage } from "../../../lib/adminRefusal";
import { notifyRealMembersText } from "../../../lib/notifyRealMembers";
import type { useActionUpdateAdmin } from "../../../lib/useActionUpdateAdmin";
import { useConfirmOnPage } from "../../../lib/useConfirmOnPage";
import Button, { ButtonVariant } from "../../../ui/Button";
import InlineError from "../../../ui/InlineError";
import { Banner, BannerTone } from "../../../ui/templates/Banner";
import { FormSection } from "../../../ui/templates/Form";
import { audienceOf, notifiedArrivalOf, pacific } from "./updateRules";

export function NotificationHeldBanner({ reason }: { reason: string }) {
  return (
    <Banner inline tone={BannerTone.Danger}>
      <p className="font-medium">
        This update&apos;s notifications are on hold.
      </p>
      <p>{reason}</p>
      <p>Fix the copy and save; they go out within a minute.</p>
    </Banner>
  );
}

/**
 * When the entries come due: the update's date, or when it publishes if that
 * is later, and never before now (`actionUpdateEntrySendTime` and
 * `checkActionShowsWhenEntriesArrive` in
 * `server/src/actions/action-update-visibility.ts`).
 */
const arrivalOf = (update: AdminActionUpdateDto, now: Date) => {
  const due = max([
    new Date(update.date),
    ...(update.visibleAt ? [new Date(update.visibleAt)] : []),
    now,
  ]);
  return due > now ? `at ${pacific(due)}, when the update comes due` : "now";
};

const sentLineOf = (
  update: AdminActionUpdateDto & { notifiedAt: string },
  now: Date,
) => {
  const arrival = notifiedArrivalOf(update);
  return arrival > now
    ? `Sent ${pacific(update.notifiedAt)}. Members get it by ${pacific(arrival)}.`
    : `Sent ${pacific(update.notifiedAt)}.`;
};

/**
 * The one-time send of the saved audience and texts
 * (`server/src/actions/action-update-notify.service.ts`, `notifyActionUpdate`).
 */
export function UpdateNotifySection({
  update,
  notify,
  blockedReason,
  onSent,
}: {
  update: AdminActionUpdateDto;
  notify: ReturnType<typeof useActionUpdateAdmin>["notify"];
  /** Why sending would send something other than what's on screen. */
  blockedReason: string | null;
  onSent: (saved: AdminActionUpdateDto) => void;
}) {
  const confirm = useConfirmOnPage();
  const [refusal, setRefusal] = useState<string | null>(null);
  const recognition = usesRecognition(update.notificationMode);

  const send = async () => {
    setRefusal(null);
    const ok = await confirm({
      title: "Send the notification?",
      message: `This notifies ${audienceOf(update)}, ${arrivalOf(update, new Date())}. It can't be undone, and an update is notified about only once.`,
      confirmLabel: "Send",
      cancelLabel: "Cancel",
      requiredText: notifyRealMembersText("many"),
    });
    if (!ok) return;
    try {
      onSent(await notify.mutateAsync());
    } catch (error) {
      setRefusal(adminRefusalMessage(error, "Couldn't send the notification."));
    }
  };

  return (
    <FormSection
      title="Notification"
      description="Sent once, to the saved audience, with the saved notification text."
    >
      {update.notificationHeldReason && (
        <NotificationHeldBanner reason={update.notificationHeldReason} />
      )}
      {update.notifiedAt ? (
        <p>
          {sentLineOf({ ...update, notifiedAt: update.notifiedAt }, new Date())}{" "}
          An update can only be notified about once.
          {recognition &&
            !update.recognitionPreparedAt &&
            " Each member's copy is sent when the update comes due."}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant={ButtonVariant.Default}
              busy={notify.isPending}
              disabled={blockedReason !== null}
              onClick={() => void send()}
            >
              <Send aria-hidden className="size-4" />
              Send notification
            </Button>
            <p className="text-fg-muted">
              {blockedReason ??
                "Nothing has been sent yet. Members are notified when you send it."}
            </p>
          </div>
          <InlineError message={refusal} />
        </div>
      )}
    </FormSection>
  );
}
