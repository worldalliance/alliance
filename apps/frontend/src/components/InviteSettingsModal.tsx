import type { CommunityDto } from "@alliance/shared/client";
import { inviteDestination } from "@alliance/shared/lib/copy";
import type { InviteNote } from "@alliance/shared/lib/inviteUtils";
import { cn } from "@alliance/shared/styles/util";
import { copyToClipboard } from "@alliance/sharedweb/lib/clipboard";
import NewButton, { ButtonColor } from "@alliance/sharedweb/ui/NewButton";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { zIndex } from "@alliance/sharedweb/ui/zIndex";
import { Check, Copy as CopyIcon, Trash2, Users, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

/** A group they lead, or `null` for "wherever there is room". */
type Destination = number | null;

const NOTE_CLASS: Record<InviteNote["tone"], string> = {
  info: "text-zinc-500",
  warning: "text-red-500",
};

export type InviteSettingsTarget = {
  /** Header line: whatever names this invite today. */
  title: string;
  /** Header sub-line: uses, age, whatever is worth knowing at a glance. */
  meta: string;
  /** The link people follow, shown and copyable. */
  url: string;
  name: {
    label: string;
    value: string;
    placeholder: string;
    helper: string;
    /** Blank is a legitimate clear for a label, but not for an invitee's name. */
    required?: boolean;
  };
  destination: {
    /** `undefined` when the invite never named one — nothing to preselect. */
    current: Destination | undefined;
    /** Wording for the "no particular group" choice, which differs per invite type. */
    openLabel: string;
    openDetail: string;
    notes: InviteNote[];
  };
  delete: { enabled: boolean; disabledReason: string; confirmMessage: string };
  onSave: (changes: {
    name?: string;
    communityId?: Destination;
  }) => Promise<unknown>;
  onDelete: () => Promise<unknown>;
};

type InviteSettingsModalProps = {
  target: InviteSettingsTarget;
  /** Groups the owner leads — the only ones an invite may point at. */
  leaderCommunities: CommunityDto[];
  onClose: () => void;
};

const InviteSettingsModal = ({
  target,
  leaderCommunities,
  onClose,
}: InviteSettingsModalProps) => {
  const { error: errorToast, success: successToast, confirm } = useToast();
  const [name, setName] = useState(target.name.value);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [destination, setDestination] = useState<Destination | undefined>(
    target.destination.current,
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const trimmedName = name.trim();
  const nameChanged = trimmedName !== target.name.value;
  const nameMissing = !!target.name.required && !trimmedName;
  const destinationChanged =
    destination !== undefined && destination !== target.destination.current;
  const dirty = nameChanged || destinationChanged;

  const handleCopy = useCallback(async () => {
    if (await copyToClipboard(target.url)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      errorToast("Could not copy the link to the clipboard.");
    }
  }, [target.url, errorToast]);

  const handleSave = useCallback(() => {
    setSaving(true);
    void target
      .onSave({
        ...(nameChanged && { name: trimmedName }),
        ...(destinationChanged && { communityId: destination }),
      })
      .then(
        () => {
          successToast("Invite updated!");
          onClose();
        },
        (err: Error) => {
          setSaving(false);
          errorToast(`Failed to save changes: ${err.message}`);
        },
      );
  }, [
    target,
    trimmedName,
    nameChanged,
    destination,
    destinationChanged,
    successToast,
    errorToast,
    onClose,
  ]);

  const handleDelete = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      void (async () => {
        const ok = await confirm({
          message: target.delete.confirmMessage,
          confirmLabel: "Delete",
          cancelLabel: "Cancel",
          anchorEl: event.currentTarget,
          placement: "topleft",
          requiredText: "DELETE",
          requiredTextPlaceholder: "Type DELETE to confirm",
        });
        if (!ok) return;
        void target
          .onDelete()
          .then(onClose, (err: Error) =>
            errorToast(`Failed to delete: ${err.message}`),
          );
      })();
    },
    [confirm, target, onClose, errorToast],
  );

  const options = useMemo(
    () => [
      ...leaderCommunities.map((community) => ({
        value: community.id as Destination,
        name: community.name,
        detail: inviteDestination.ledGroupDetail,
      })),
      {
        value: null as Destination,
        name: target.destination.openLabel,
        detail: target.destination.openDetail,
      },
    ],
    [leaderCommunities, target.destination],
  );

  return createPortal(
    <div
      className={cn(
        zIndex.modal,
        "fixed inset-0 flex items-end justify-center bg-black/50 backdrop-blur-[2px] sm:items-center sm:p-4",
      )}
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Invite settings"
      >
        <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-semibold text-zinc-900">
              {target.title}
            </h2>
            <p className="text-xs text-zinc-500">{target.meta}</p>
          </div>
          <button
            onClick={onClose}
            className="-mr-1.5 shrink-0 rounded-full p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-y-6 overflow-y-auto px-5 py-5">
          <div className="flex items-center gap-2 rounded-xl bg-zinc-50 p-1.5 pl-3.5">
            <p className="min-w-0 flex-1 truncate font-mono text-xs text-zinc-500">
              {target.url}
            </p>
            <NewButton
              color={copied ? ButtonColor.Green : ButtonColor.White}
              onClick={() => void handleCopy()}
              disabled={copied}
              iconLeft={!copied && CopyIcon}
              className="shrink-0 whitespace-nowrap"
            >
              {copied ? "Copied!" : "Copy"}
            </NewButton>
          </div>

          <label className="flex flex-col gap-y-2">
            <span className="text-sm font-semibold text-zinc-900">
              {target.name.label}
            </span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={target.name.placeholder}
              className="rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-900"
            />
            <span className="text-xs text-zinc-500">{target.name.helper}</span>
          </label>

          <div className="flex flex-col gap-y-2">
            <span className="text-sm font-semibold text-zinc-900">
              {inviteDestination.heading}
            </span>
            {target.destination.notes.map((note) => (
              <p
                key={note.text}
                className={cn("text-xs", NOTE_CLASS[note.tone])}
              >
                {note.text}
              </p>
            ))}
            <div className="flex flex-col gap-y-2">
              {options.map((option) => {
                const selected = destination === option.value;
                return (
                  <button
                    key={option.value ?? "open"}
                    type="button"
                    onClick={() => setDestination(option.value)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors",
                      selected
                        ? "border-zinc-900 bg-zinc-900/[0.03]"
                        : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50",
                    )}
                  >
                    <Users
                      size={16}
                      className={selected ? "text-zinc-900" : "text-zinc-400"}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-zinc-900">
                        {option.name}
                      </span>
                      <span className="block truncate text-xs text-zinc-500">
                        {option.detail}
                      </span>
                    </span>
                    {selected && (
                      <Check size={16} className="shrink-0 text-zinc-900" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-zinc-100 px-5 py-4">
          {target.delete.enabled ? (
            <button
              type="button"
              onClick={handleDelete}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-red-500 transition-colors hover:bg-red-50"
            >
              <Trash2 size={15} />
              Delete
            </button>
          ) : (
            <span className="text-xs text-zinc-400">
              {target.delete.disabledReason}
            </span>
          )}
          <NewButton
            color={ButtonColor.Black}
            onClick={handleSave}
            disabled={!dirty || nameMissing || saving}
            className="shrink-0"
          >
            {saving ? "Saving..." : "Save changes"}
          </NewButton>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default InviteSettingsModal;
