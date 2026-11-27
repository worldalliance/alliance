import {
  WaitlistEmailPlaceholder,
  waitlistEmailToken,
} from "@alliance/common/waitlistEmail";
import type { AdminWaitlistTagDto } from "@alliance/shared/client/types.gen";
import { ChevronDown } from "lucide-react";
import { useRef, useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { countOf } from "../../lib/formatNumber";
import {
  useChangeWaitlistEntriesAdmin,
  WaitlistEntryChange,
} from "../../lib/useWaitlistEntriesAdmin";
import { useChangeWaitlistEntryTagsAdmin } from "../../lib/useWaitlistTagsAdmin";
import Button, { ButtonVariant } from "../../ui/Button";
import { cn } from "../../ui/cn";
import ConfirmDialog from "../../ui/ConfirmDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../ui/DropdownMenu";
import { useToast } from "../../ui/ToastProvider";
import { menuTriggerClass } from "./MultiSelectMenu";
import { NameDialog } from "./NameDialog";

const SPAM_CHANGE_FAILED = "Couldn't change the spam status.";
const MOBILIZED_FAILED = "Couldn't change the mobilized status.";

/** What each change says before and after, from `waitlist-entry-admin.service.ts`. */
const CHANGES: Record<
  WaitlistEntryChange,
  {
    label: string;
    title: string;
    confirmLabel: string;
    message: (selected: string) => string;
    changedNoun: string;
    done: (changed: string) => string;
    failed: string;
  }
> = {
  [WaitlistEntryChange.Mark]: {
    label: "Mark mobilized",
    title: "Mark as mobilized?",
    confirmLabel: "Mark as mobilized",
    message: (selected) =>
      `Mark the waiting ones among ${selected} as mobilized. This sends no email and issues no invite; use it for people accepted outside the app. Entries already mobilized keep their date.`,
    changedNoun: "entry",
    done: (changed) => `Marked ${changed} mobilized`,
    failed: MOBILIZED_FAILED,
  },
  [WaitlistEntryChange.Undo]: {
    label: "Undo mobilized",
    title: "Undo mobilization?",
    confirmLabel: "Return to waiting",
    message: (selected) =>
      `Return the mobilized ones among ${selected} to waiting. Any invite already sent stays usable; revoke it separately if they shouldn't sign up.`,
    changedNoun: "entry",
    done: (changed) => `Returned ${changed} to waiting`,
    failed: MOBILIZED_FAILED,
  },
  [WaitlistEntryChange.RevokeInvites]: {
    label: "Revoke invites",
    title: "Revoke unused invites?",
    confirmLabel: "Revoke invites",
    message: (selected) =>
      `Revoke the unused signup invites of ${selected}, so their signup links stop working. Mobilized status stays as it is, and the next email with ${waitlistEmailToken(WaitlistEmailPlaceholder.SignupLink)} sends a new invite. An invite in an email being sent right now is kept.`,
    changedNoun: "invite",
    done: (changed) => `Revoked ${changed}`,
    failed: "Couldn't revoke the invites.",
  },
  [WaitlistEntryChange.MarkSpam]: {
    label: "Mark as spam",
    title: "Mark as spam?",
    confirmLabel: "Mark spam",
    message: (selected) =>
      `Mark ${selected} as spam. They get no more email, drop out of the public waitlist count, and are hidden by the default spam filter.`,
    changedNoun: "entry",
    done: (changed) => `Marked ${changed} as spam`,
    failed: SPAM_CHANGE_FAILED,
  },
  [WaitlistEntryChange.MarkNotSpam]: {
    label: "Mark as not spam",
    title: "Mark as not spam?",
    confirmLabel: "Mark not spam",
    message: (selected) =>
      `Mark ${selected} as not spam, so they can get email again. The confirmation email they missed isn't sent; include them in a waitlist email instead.`,
    changedNoun: "entry",
    done: (changed) => `Marked ${changed} as not spam`,
    failed: SPAM_CHANGE_FAILED,
  },
};

const IN_MORE: readonly WaitlistEntryChange[] = [
  WaitlistEntryChange.Undo,
  WaitlistEntryChange.RevokeInvites,
  WaitlistEntryChange.MarkSpam,
  WaitlistEntryChange.MarkNotSpam,
];

/**
 * The selection's actions in the bulk bar. Each confirmation acts on the
 * entries selected when it opened, and stays open while its write runs.
 */
export function BulkActions({
  selected,
  tags,
  onChanged,
  onFailure,
}: {
  selected: ReadonlySet<number>;
  tags: AdminWaitlistTagDto[];
  /** After any change succeeds: the selection is done with. */
  onChanged: () => void;
  onFailure: (message: string) => void;
}) {
  const { success } = useToast();
  const [naming, setNaming] = useState(false);
  const namingRef = useRef(false);
  const [tagRefusal, setTagRefusal] = useState<string | null>(null);
  const [removing, setRemoving] = useState<{
    tag: AdminWaitlistTagDto;
    entryIds: number[];
  } | null>(null);
  const [confirming, setConfirming] = useState<{
    kind: WaitlistEntryChange;
    entryIds: number[];
  } | null>(null);

  const openNaming = (open: boolean) => {
    namingRef.current = open;
    setNaming(open);
  };

  const tag = useChangeWaitlistEntryTagsAdmin({
    onTagReady: () => openNaming(false),
    onSuccess: ({ tag: changedTag, add, changed }) => {
      onChanged();
      success(
        add
          ? `Tagged ${countOf(changed, "entry")} “${changedTag.name}”`
          : `Removed “${changedTag.name}” from ${countOf(changed, "entry")}`,
      );
    },
    onError: (err) => {
      const message = adminRefusalMessage(err, "Couldn't change tags.");
      // A name refused before the tag existed stays in its dialog.
      if (namingRef.current) setTagRefusal(message);
      else onFailure(message);
    },
    onSettled: () => setRemoving(null),
  });

  const change = useChangeWaitlistEntriesAdmin({
    onSuccess: (changed, kind) => {
      onChanged();
      success(CHANGES[kind].done(countOf(changed, CHANGES[kind].changedNoun)));
    },
    onError: (err, kind) =>
      onFailure(adminRefusalMessage(err, CHANGES[kind].failed)),
    onSettled: () => setConfirming(null),
  });

  const entryIds = () => [...selected];
  const open = (kind: WaitlistEntryChange) =>
    setConfirming({ kind, entryIds: entryIds() });
  const busy = tag.isPending || change.isPending;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={menuTriggerClass}
          disabled={tag.isPending}
        >
          Add tag
          <ChevronDown aria-hidden="true" className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="max-h-80 min-w-44">
          {tags.map((t) => (
            <DropdownMenuItem
              key={t.id}
              onClick={() =>
                tag.mutate({ tag: t, add: true, entryIds: entryIds() })
              }
            >
              {t.name}
            </DropdownMenuItem>
          ))}
          {tags.length > 0 && <DropdownMenuSeparator />}
          <DropdownMenuItem
            onClick={() => {
              setTagRefusal(null);
              openNaming(true);
            }}
          >
            New tag…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={menuTriggerClass}
          disabled={tag.isPending || tags.length === 0}
        >
          Remove tag
          <ChevronDown aria-hidden="true" className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="max-h-80 min-w-44">
          {tags.map((t) => (
            <DropdownMenuItem
              key={t.id}
              onClick={() => setRemoving({ tag: t, entryIds: entryIds() })}
            >
              {t.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        size="small"
        variant={ButtonVariant.Default}
        disabled={change.isPending}
        onClick={() => open(WaitlistEntryChange.Mark)}
      >
        {CHANGES[WaitlistEntryChange.Mark].label}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="More actions on selected entries"
          aria-busy={busy || undefined}
          className={cn(menuTriggerClass, "aria-busy:cursor-progress")}
        >
          More
          <ChevronDown aria-hidden="true" className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="min-w-48">
          {IN_MORE.map((kind) => (
            <DropdownMenuItem
              key={kind}
              disabled={change.isPending}
              onClick={() => open(kind)}
            >
              {CHANGES[kind].label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {naming && (
        <NameDialog
          title="New tag"
          label="New tag name"
          description={`Creates the tag and adds it to the ${countOf(selected.size, "selected entry")}.`}
          submitLabel="Create and tag"
          busy={tag.isPending}
          error={tagRefusal}
          onSubmit={(name) =>
            tag.mutate({ tag: { name }, add: true, entryIds: entryIds() })
          }
          onClose={() => openNaming(false)}
        />
      )}
      <ConfirmDialog
        open={removing !== null}
        title={`Remove the tag “${removing?.tag.name}”?`}
        message={`Removes the tag from any of the ${countOf(removing?.entryIds.length ?? 0, "selected entry")} that have it.`}
        confirmLabel="Remove tag"
        busy={tag.isPending}
        onConfirm={() =>
          removing &&
          tag.mutate({
            tag: removing.tag,
            add: false,
            entryIds: removing.entryIds,
          })
        }
        onCancel={() => setRemoving(null)}
      />
      <ConfirmDialog
        open={confirming !== null}
        title={confirming ? CHANGES[confirming.kind].title : ""}
        message={
          confirming
            ? CHANGES[confirming.kind].message(
                countOf(confirming.entryIds.length, "selected entry"),
              )
            : ""
        }
        confirmLabel={confirming ? CHANGES[confirming.kind].confirmLabel : ""}
        busy={change.isPending}
        onConfirm={() => confirming && change.mutate(confirming)}
        onCancel={() => setConfirming(null)}
      />
    </>
  );
}
