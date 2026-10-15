import { useActionsAdmin } from "@alliance/shared/lib/useActionsAdmin";
import { CardStyle } from "@alliance/shared/styles/card";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import { ToastPlacement, useToast } from "@alliance/sharedweb/ui/ToastProvider";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { actionsLoadError } from "../../lib/actionsLoadError";
import {
  externalShareTargetsLoadError,
  useExternalShareTargetsAdmin,
} from "../../lib/useExternalShareTargetsAdmin";
import { useRefusalToast } from "../../lib/useRefusalToast";
import {
  type ShareLinkOwner,
  shareLinksLoadError,
  useShareLinksAdmin,
} from "../../lib/useShareLinksAdmin";
import GroupCard from "./GroupCard";
import TargetPicker from "./TargetPicker";
import {
  groupShareLinks,
  type Target,
  targetColumns,
  targetKey,
  type TargetKind,
} from "./shareLinkTargets";

export type Owner = ShareLinkOwner & { name: string };

const ownerKey = (o: Owner): string => `${o.type}-${o.id}`;

const ShareLinkManager: React.FC<{
  owner: Owner | null;
  onCopy: (url: string) => void;
}> = ({ owner, onCopy }) => {
  const {
    links,
    updateLabel: { mutateAsync: updateLabel },
    remove: { mutateAsync: removeLink },
    createDuplicate: { mutateAsync: createDuplicate, isPending: creating },
  } = useShareLinksAdmin(owner);
  const rows = useMemo(() => links.data ?? [], [links.data]);

  const actions = useActionsAdmin();
  const externalTargets = useExternalShareTargetsAdmin();

  const [selectedKind, setSelectedKind] = useState<TargetKind>("action");
  const [selectedTarget, setSelectedTarget] = useState<Target | null>(null);
  const [labelDraft, setLabelDraft] = useState<string>("");

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const ownerKeyRef = useRef<string | null>(null);
  const currentOwnerKey = owner ? ownerKey(owner) : null;
  useEffect(() => {
    ownerKeyRef.current = currentOwnerKey;
  }, [currentOwnerKey]);

  const { success, confirm } = useToast();
  const refusalToast = useRefusalToast();

  useEffect(() => {
    if (owner) return;
    setExpanded({});
    setSelectedTarget(null);
    setLabelDraft("");
  }, [owner]);

  const targetsForKind = useMemo((): Target[] => {
    switch (selectedKind) {
      case "action":
        return (actions.data ?? [])
          .filter((a) => !a.archived)
          .map((a) => ({ kind: "action", id: a.id, name: a.name }));
      case "external":
        return (externalTargets.data ?? []).map((t) => ({
          kind: "external",
          id: t.id,
          name: t.name,
        }));
      case "invite":
        return [{ kind: "invite" }];
      default:
        throw new Error(`unknown target kind: ${selectedKind satisfies never}`);
    }
  }, [selectedKind, actions.data, externalTargets.data]);

  const targetsLoadError: Record<TargetKind, string | null> = {
    action:
      actions.isError && !actions.data ? actionsLoadError(actions.error) : null,
    external:
      externalTargets.isError && !externalTargets.data
        ? externalShareTargetsLoadError(externalTargets.error)
        : null,
    invite: null,
  };
  const targetsLoading: Record<TargetKind, boolean> = {
    action: actions.isPending,
    external: externalTargets.isPending,
    invite: false,
  };

  const handleKindChange = useCallback((kind: TargetKind) => {
    setSelectedKind(kind);
    // Invite has no target to choose, so select it implicitly.
    setSelectedTarget(kind === "invite" ? { kind: "invite" } : null);
  }, []);

  const groups = useMemo(() => groupShareLinks(rows), [rows]);

  // Auto-expand groups that have duplicates; collapse canonical-only ones —
  // but preserve any manual overrides the admin has made.
  useEffect(() => {
    setExpanded((prev) => {
      const next: Record<string, boolean> = { ...prev };
      for (const group of groups) {
        if (next[group.key] === undefined) {
          next[group.key] = group.duplicateCount > 0;
        }
      }
      return next;
    });
  }, [groups]);

  const handleToggleExpanded = useCallback((key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleUpdateLabel = useCallback(
    async (id: string, label: string): Promise<boolean> => {
      if (!owner) return false;
      const requestKey = ownerKey(owner);
      try {
        await updateLabel({ owner, id, label });
        if (ownerKeyRef.current !== requestKey) return false;
        success("Label updated");
        return true;
      } catch (err) {
        if (ownerKeyRef.current !== requestKey) return false;
        refusalToast(err, "Failed to update label.");
        return false;
      }
    },
    [owner, updateLabel, success, refusalToast],
  );

  const handleDelete = useCallback(
    async (id: string, event: React.MouseEvent<HTMLElement>) => {
      const ok = await confirm({
        message:
          "Delete this share link? Any URL already handed out using it will stop working.",
        confirmLabel: "Delete",
        cancelLabel: "Cancel",
        anchorEl: event.currentTarget,
        placement: ToastPlacement.TopLeft,
      });
      if (!ok || !owner) return;
      const requestKey = ownerKey(owner);
      try {
        await removeLink({ owner, id });
        if (ownerKeyRef.current !== requestKey) return;
        success("Share link deleted");
      } catch (err) {
        if (ownerKeyRef.current !== requestKey) return;
        refusalToast(err, "Failed to delete share link.");
      }
    },
    [owner, confirm, removeLink, success, refusalToast],
  );

  const handleCreateDuplicate = useCallback(async () => {
    if (!owner || !selectedTarget) return;
    const requestKey = ownerKey(owner);
    const requestTarget = selectedTarget;
    try {
      const trimmed = labelDraft.trim();
      await createDuplicate({
        owner,
        target: {
          ...targetColumns(requestTarget),
          label: trimmed || undefined,
        },
      });
      if (ownerKeyRef.current !== requestKey) return;
      setExpanded((prev) => ({ ...prev, [targetKey(requestTarget)]: true }));
      setLabelDraft("");
      success("Duplicate link created");
    } catch (err) {
      if (ownerKeyRef.current !== requestKey) return;
      refusalToast(err, "Failed to create duplicate.");
    }
  }, [
    owner,
    selectedTarget,
    labelDraft,
    createDuplicate,
    success,
    refusalToast,
  ]);

  if (!owner) return null;

  return (
    <>
      <Card className="w-full" style={CardStyle.White}>
        <div className="flex flex-col gap-3">
          <p className="font-semibold">Create duplicate link</p>
          <p className="text-xs text-zinc-500">
            Pick any action or external target — duplicates can be created for
            targets that {owner.name} hasn&apos;t shared yet too.
          </p>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-700">Kind</label>
            <select
              className="border border-zinc-300 rounded px-3 py-2 text-sm bg-white"
              value={selectedKind}
              onChange={(event) =>
                handleKindChange(event.target.value as TargetKind)
              }
              disabled={creating}
            >
              <option value="action">Action</option>
              <option value="external">External target</option>
              <option value="invite">Invite (signup link)</option>
            </select>
          </div>
          {selectedKind === "invite" ? (
            <p className="text-xs text-zinc-500">
              A single trackable signup link will be created for {owner.name},
              attributing new signups to them as a source.
            </p>
          ) : (
            <TargetPicker
              kind={selectedKind}
              targets={targetsForKind}
              loadError={targetsLoadError[selectedKind]}
              loading={targetsLoading[selectedKind]}
              value={selectedTarget}
              onChange={setSelectedTarget}
              disabled={creating}
            />
          )}
          <input
            type="text"
            className="border border-zinc-300 rounded px-3 py-2 text-sm"
            placeholder="Label (optional) — e.g. recruit's name"
            value={labelDraft}
            onChange={(event) => setLabelDraft(event.target.value)}
            disabled={creating}
          />
          <Button
            type="button"
            color={ButtonColor.Blue}
            onClick={handleCreateDuplicate}
            disabled={creating || !selectedTarget}
            className="self-start"
          >
            {creating ? "Creating…" : "Create duplicate"}
          </Button>
        </div>
      </Card>

      <div className="flex flex-col gap-3">
        <p className="font-semibold text-sm text-zinc-700 mt-2">
          Existing share links
        </p>
        {links.isError && !links.data ? (
          <p className="text-sm text-red-500">
            {shareLinksLoadError(links.error)}
          </p>
        ) : links.isPending ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : groups.length === 0 ? (
          <Card className="w-full" style={CardStyle.White}>
            <p className="text-sm text-zinc-500">
              {owner.name} has no share links yet.
            </p>
          </Card>
        ) : (
          groups.map((group) => (
            <GroupCard
              key={group.key}
              target={group.target}
              rows={group.rows}
              duplicateCount={group.duplicateCount}
              expanded={!!expanded[group.key]}
              onToggle={() => handleToggleExpanded(group.key)}
              onCopy={onCopy}
              onUpdateLabel={handleUpdateLabel}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>
    </>
  );
};

export default ShareLinkManager;
