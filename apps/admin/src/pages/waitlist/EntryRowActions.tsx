import type {
  AdminWaitlistEntryDto,
  WaitlistEntryFilterDto,
} from "@alliance/shared/client/types.gen";
import { ChevronDown } from "lucide-react";
import { useRef } from "react";
import { rowRefusalMessage } from "../../lib/adminRefusal";
import { useConfirmOnPage } from "../../lib/useConfirmOnPage";
import {
  useChangeWaitlistEntriesAdmin,
  useUnsubscribeWaitlistEntryAdmin,
  WaitlistEntryChange,
} from "../../lib/useWaitlistEntriesAdmin";
import { SPAM_STATUSES } from "../../lib/waitlistFilter";
import Button, { ButtonVariant } from "../../ui/Button";
import { cn } from "../../ui/cn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../ui/DropdownMenu";
import { useToast } from "../../ui/ToastProvider";
import { menuTriggerClass } from "./MultiSelectMenu";

export type EntryAfterWrite = Pick<
  AdminWaitlistEntryDto,
  "spamStatus" | "unsubscribedAt"
>;

/** Whether a row still matches the filter's spam and subscription parts after a write. */
export const filterKeeps = (
  filter: WaitlistEntryFilterDto,
  entry: EntryAfterWrite,
) =>
  (!filter.spamStatuses?.length ||
    filter.spamStatuses.includes(entry.spamStatus)) &&
  (filter.subscribed === undefined ||
    filter.subscribed === (entry.unsubscribedAt === null));

export enum EntryDialog {
  Invitation = "invitation",
  Referral = "referral",
}

/**
 * A row's actions: its signup invitation, and in "More" its referral link,
 * the spam ruling (at once, no confirmation, as today) and, for a subscribed
 * phone entry, marking it unsubscribed.
 */
export function EntryRowActions({
  entry,
  onOpen,
  onSpamChanged,
  onWriting,
  onFailure,
}: {
  entry: AdminWaitlistEntryDto;
  onOpen: (dialog: EntryDialog) => void;
  onSpamChanged: () => void;
  /** Gets the entry as a write will leave it; what it returns runs once the write succeeds. */
  onWriting: (after: EntryAfterWrite) => () => void;
  onFailure: (message: string) => void;
}) {
  const { success } = useToast();
  const confirm = useConfirmOnPage();
  const spamLike = SPAM_STATUSES[entry.spamStatus].spamLike;
  const written = useRef(() => {});
  const writing = (after: EntryAfterWrite) => {
    written.current = onWriting(after);
  };

  const spam = useChangeWaitlistEntriesAdmin({
    onSuccess: () => {
      written.current();
      onSpamChanged();
      success(`Marked ${entry.name} as ${spamLike ? "not spam" : "spam"}`);
    },
    onError: (err) =>
      onFailure(
        rowRefusalMessage(err, `Couldn't change ${entry.name}'s spam status`),
      ),
    onSettled: () => {},
  });
  const unsubscribe = useUnsubscribeWaitlistEntryAdmin({
    onSuccess: () => {
      written.current();
      success(`Marked ${entry.name} unsubscribed`);
    },
    onError: (err) =>
      onFailure(
        rowRefusalMessage(err, `Couldn't mark ${entry.name} unsubscribed`),
      ),
    onSettled: () => {},
  });

  const confirmUnsubscribe = async () => {
    const ok = await confirm({
      title: `Mark ${entry.name} unsubscribed?`,
      message:
        "Records that they asked to stop being contacted. Joining again doesn't resubscribe them, and there is no way to undo this here.",
      confirmLabel: "Mark unsubscribed",
    });
    if (!ok) return;
    writing({ ...entry, unsubscribedAt: new Date().toISOString() });
    unsubscribe.mutate(entry.id);
  };

  return (
    <>
      <Button
        size="small"
        variant={ButtonVariant.Default}
        aria-label={`Signup invitation for ${entry.name}`}
        onClick={() => onOpen(EntryDialog.Invitation)}
      >
        Signup invitation…
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`More: ${entry.name}`}
          aria-busy={spam.isPending || unsubscribe.isPending || undefined}
          className={cn(menuTriggerClass, "aria-busy:cursor-progress")}
        >
          More
          <ChevronDown aria-hidden="true" className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuItem onClick={() => onOpen(EntryDialog.Referral)}>
            Referral link…
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={spam.isPending}
            onClick={() => {
              writing({
                ...entry,
                spamStatus: spamLike ? "not_spam" : "spam",
              });
              spam.mutate({
                kind: spamLike
                  ? WaitlistEntryChange.MarkNotSpam
                  : WaitlistEntryChange.MarkSpam,
                entryIds: [entry.id],
              });
            }}
          >
            {spamLike ? "Mark as not spam" : "Mark as spam"}
          </DropdownMenuItem>
          {entry.phoneNumber && !entry.unsubscribedAt && (
            <DropdownMenuItem
              disabled={unsubscribe.isPending}
              onClick={() => void confirmUnsubscribe()}
            >
              Mark unsubscribed…
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
