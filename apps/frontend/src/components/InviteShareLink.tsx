import { ShareUrlMineDto } from "@alliance/shared/client";
import { useReusableInvites } from "@alliance/shared/lib/useReusableInvites";
import { CardStyle } from "@alliance/shared/styles/card";
import { cn } from "@alliance/shared/styles/util";
import Card from "@alliance/sharedweb/ui/Card";
import NewButton, { ButtonColor } from "@alliance/sharedweb/ui/NewButton";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { Copy as CopyIcon, Pencil } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import ExpandableList from "./ExpandableList";

const inviteTitleClass = "font-semibold text-xl text-zinc-900";

type InviteShareLinkProps = {
  showCreateCard?: boolean;
};

const InviteShareLink = ({ showCreateCard = true }: InviteShareLinkProps) => {
  const { error: errorToast, confirm } = useToast();
  const {
    links,
    isPending,
    isError,
    isCreating,
    createInvite,
    updateLabel,
    deleteInvite,
  } = useReusableInvites();
  const [labelDraft, setLabelDraft] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
    };
  }, []);

  const handleCreate = useCallback(() => {
    createInvite(labelDraft).then(
      () => setLabelDraft(""),
      (err: Error) =>
        errorToast(`Failed to create invite link: ${err.message}`),
    );
  }, [createInvite, labelDraft, errorToast]);

  const handleCopy = useCallback((link: ShareUrlMineDto) => {
    navigator.clipboard.writeText(link.url);
    if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
    setCopiedId(link.id);
    copiedTimeoutRef.current = setTimeout(() => {
      setCopiedId(null);
      copiedTimeoutRef.current = null;
    }, 2000);
  }, []);

  const handleSaveLabel = useCallback(
    (id: string, label: string) =>
      updateLabel({ id, label }).then(
        () => true,
        (err: Error) => {
          errorToast(`Failed to update label: ${err.message}`);
          return false;
        },
      ),
    [updateLabel, errorToast],
  );

  const handleDelete = useCallback(
    (id: string, event: React.MouseEvent<HTMLElement>) => {
      void (async () => {
        const ok = await confirm({
          message:
            "Delete this invite link? Anyone you've already shared it with won't be able to use it.",
          confirmLabel: "Delete",
          cancelLabel: "Cancel",
          anchorEl: event.currentTarget,
          placement: "topleft",
          requiredText: "DELETE",
          requiredTextPlaceholder: "Type DELETE to confirm",
        });
        if (!ok) return;
        deleteInvite(id).catch((err: Error) =>
          errorToast(`Failed to delete invite link: ${err.message}`),
        );
      })();
    },
    [confirm, deleteInvite, errorToast],
  );

  return (
    <>
      {showCreateCard && (
        <Card style={CardStyle.White} className="p-6">
          <div className="flex flex-col gap-y-4">
            <div className="flex flex-col gap-y-2">
              <p className={inviteTitleClass}>Invite multiple people</p>
              <p className="text-invite-form-body">
                Create one invite link you can share with multiple people. Add
                a label to remember where you shared each one.
              </p>
            </div>
            <div className="flex flex-col gap-y-4">
              <input
                type="text"
                className="border border-zinc-300 rounded px-3 py-2"
                placeholder="Label this link (optional) — e.g. Instagram bio"
                value={labelDraft}
                onChange={(event) => setLabelDraft(event.target.value)}
                disabled={isCreating}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleCreate();
                  }
                }}
              />
              <NewButton
                color={ButtonColor.Black}
                onClick={handleCreate}
                disabled={isCreating}
                className="w-full"
              >
                {isCreating ? "Creating..." : "Create invite link"}
              </NewButton>
            </div>
          </div>
        </Card>
      )}

      {isError ? (
        <p className="text-red-500 text-sm">Failed to load invite links</p>
      ) : isPending ? (
        <p className="text-zinc-500 text-sm">Loading…</p>
      ) : links.length === 0 && !showCreateCard ? null : (
        <div
          className={cn(
            "flex flex-col gap-y-4",
            !showCreateCard && "pt-5",
          )}
        >
          <div className="flex flex-col gap-y-1">
            <p className="font-semibold text-2xl">Your multi-use invites</p>
            <p className="text-zinc-500">
              Each link can be shared with and used by many people.
            </p>
          </div>
          {links.length === 0 ? (
            <p className="text-zinc-500 text-center text-base sm:text-lg">
              Your multi-use invites will appear here once you create them.
            </p>
          ) : (
            <ExpandableList>
              {links.map((link) => (
                <InviteLinkRow
                  key={link.id}
                  link={link}
                  copied={copiedId === link.id}
                  onCopy={handleCopy}
                  onSaveLabel={handleSaveLabel}
                  onDelete={handleDelete}
                />
              ))}
            </ExpandableList>
          )}
        </div>
      )}
    </>
  );
};

type InviteLinkRowProps = {
  link: ShareUrlMineDto;
  copied: boolean;
  onCopy: (link: ShareUrlMineDto) => void;
  onSaveLabel: (id: string, label: string) => Promise<boolean>;
  onDelete: (id: string, event: React.MouseEvent<HTMLElement>) => void;
};

const InviteLinkRow = ({
  link,
  copied,
  onCopy,
  onSaveLabel,
  onDelete,
}: InviteLinkRowProps) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(link.label ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(link.label ?? "");
  }, [link.label, editing]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    const ok = await onSaveLabel(link.id, draft);
    setSaving(false);
    if (ok) setEditing(false);
  }, [onSaveLabel, link.id, draft]);

  const handleCancel = useCallback(() => {
    setDraft(link.label ?? "");
    setEditing(false);
  }, [link.label]);

  return (
    <div className="flex flex-col sm:flex-row w-full justify-between p-4 gap-y-3 sm:gap-y-0">
      <div className="flex flex-col min-w-0 gap-y-0.5">
        {!link.duplicate ? (
          <span className="text-lg font-semibold truncate text-zinc-900">
            {link.label || "Primary invite"}
          </span>
        ) : editing ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <input
              type="text"
              className="border border-zinc-300 rounded px-3 py-2 flex-1"
              placeholder="Label"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              disabled={saving}
              autoFocus
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleSave();
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  handleCancel();
                }
              }}
            />
            <div className="flex flex-row items-center gap-2">
              <NewButton
                color={ButtonColor.Green}
                onClick={handleSave}
                disabled={saving}
                className="shrink-0"
              >
                {saving ? "Saving…" : "Save"}
              </NewButton>
              <NewButton
                color={ButtonColor.White}
                onClick={handleCancel}
                disabled={saving}
                className="shrink-0"
              >
                Cancel
              </NewButton>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="group flex flex-row items-center gap-x-1.5 self-start max-w-full text-left"
            aria-label="Edit label"
          >
            <span
              className={cn(
                "text-lg font-semibold truncate",
                link.label
                  ? "text-zinc-900 group-hover:text-zinc-700"
                  : "italic text-zinc-400 group-hover:text-zinc-600",
              )}
            >
              {link.label || "Add a label"}
            </span>
            <Pencil
              size={14}
              className="shrink-0 text-zinc-400 group-hover:text-zinc-700"
            />
          </button>
        )}
        <p className="break-all text-sm text-zinc-400 font-mono">{link.url}</p>
      </div>

      <div className="flex flex-col sm:items-end justify-between sm:gap-2">
        {!link.duplicate && (
          <span className="text-sm font-semibold text-green">Primary</span>
        )}
        <div className="mt-2 sm:mt-0 flex flex-row items-center sm:justify-end gap-2">
          <NewButton
            color={copied ? ButtonColor.Green : ButtonColor.White}
            disabled={copied}
            onClick={() => onCopy(link)}
            iconLeft={!copied && CopyIcon}
          >
            {copied ? "Copied!" : "Copy link"}
          </NewButton>
          {link.duplicate && (
            <NewButton
              color={ButtonColor.Black}
              onClick={(event) => onDelete(link.id, event)}
            >
              Delete
            </NewButton>
          )}
        </div>
      </div>
    </div>
  );
};

export default InviteShareLink;
