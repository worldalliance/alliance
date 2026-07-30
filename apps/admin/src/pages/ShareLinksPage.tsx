import {
  actionsFindAllWithDraftsAdmin,
  campaignCreateAdmin,
  campaignFindAllAdmin,
  externalShareTargetsFindAllAdmin,
  imagesUploadImage,
  shareUrlsCreateDuplicateAdmin,
  shareUrlsDeleteAdmin,
  shareUrlsFindForCampaignAdmin,
  shareUrlsFindForUserAdmin,
  shareUrlsUpdateLabelAdmin,
} from "@alliance/shared/client";
import type {
  ActionDto,
  CampaignDto,
  ExternalShareTargetDto,
  ShareUrlAdminDto,
} from "@alliance/shared/client/types.gen";
import { getReferralSignupUrl } from "@alliance/shared/lib/inviteUrls";
import { CardStyle } from "@alliance/shared/styles/card";
import { cn } from "@alliance/shared/styles/util";
import { getBaseUrl } from "@alliance/sharedweb/lib/config";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import UserSelect, {
  useSelectableUserIds,
} from "@alliance/sharedweb/ui/UserSelect";
import { ChevronDown, ChevronRight, Copy, Pencil, Trash2 } from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type TargetKind = "action" | "external" | "invite";

type Target =
  | { kind: "action"; id: number; name: string }
  | { kind: "external"; id: number; name: string }
  | { kind: "invite" };

const targetKey = (t: Target): string =>
  t.kind === "invite" ? "invite" : `${t.kind}-${t.id}`;

const targetName = (t: Target): string =>
  t.kind === "invite" ? "Signup invite" : t.name;

const targetKindLabel = (kind: TargetKind): string => {
  switch (kind) {
    case "action":
      return "Action";
    case "external":
      return "External target";
    case "invite":
      return "Invite (signup link)";
    default:
      throw new Error(`unknown target kind: ${kind satisfies never}`);
  }
};

const targetSubtitle = (t: Target): string => {
  switch (t.kind) {
    case "action":
      return `Action #${t.id}`;
    case "external":
      return "External share target";
    case "invite":
      return "Signup invite link";
    default:
      throw new Error(`unknown target kind: ${t satisfies never}`);
  }
};

/** The target identity to send to the create-duplicate endpoint. */
const targetColumns = (
  t: Target,
): { actionId?: number; externalTargetId?: number; invite?: true } => {
  switch (t.kind) {
    case "action":
      return { actionId: t.id };
    case "external":
      return { externalTargetId: t.id };
    case "invite":
      return { invite: true };
    default:
      throw new Error(`unknown target kind: ${t satisfies never}`);
  }
};

type OwnerKind = "user" | "campaign";

type Owner =
  | { type: "user"; id: number; name: string }
  | { type: "campaign"; id: number; name: string };

const ownerKey = (o: Owner): string => `${o.type}-${o.id}`;

/** The owner identity to send to endpoints keyed by user/campaign id. */
const ownerColumns = (
  owner: Owner,
): { userId?: number; campaignId?: number } => {
  switch (owner.type) {
    case "user":
      return { userId: owner.id };
    case "campaign":
      return { campaignId: owner.id };
    default:
      throw new Error(`unknown owner type: ${owner satisfies never}`);
  }
};

const loadShareUrlsForOwner = (
  owner: Owner,
): Promise<{ data?: ShareUrlAdminDto[] }> => {
  switch (owner.type) {
    case "user":
      return shareUrlsFindForUserAdmin({ path: { userId: owner.id } });
    case "campaign":
      return shareUrlsFindForCampaignAdmin({
        path: { campaignId: owner.id },
      });
    default:
      throw new Error(`unknown owner type: ${owner satisfies never}`);
  }
};

const ShareLinksPage: React.FC = () => {
  const users = useSelectableUserIds();
  const [ownerKind, setOwnerKind] = useState<OwnerKind>("user");

  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const selectedUserId = selectedUserIds[0] ?? null;
  const selectedUser = users.find((u) => u.id === selectedUserId);

  const [campaigns, setCampaigns] = useState<CampaignDto[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(
    null,
  );
  const selectedCampaign =
    campaigns.find((c) => c.id === selectedCampaignId) ?? null;

  const owner = useMemo((): Owner | null => {
    if (ownerKind === "user") {
      return selectedUser
        ? { type: "user", id: selectedUser.id, name: selectedUser.name }
        : null;
    }
    return selectedCampaign
      ? {
          type: "campaign",
          id: selectedCampaign.id,
          name: selectedCampaign.name,
        }
      : null;
  }, [ownerKind, selectedUser, selectedCampaign]);
  const ownerName = owner?.name ?? "this owner";

  const [rows, setRows] = useState<ShareUrlAdminDto[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);

  const [actions, setActions] = useState<ActionDto[]>([]);
  const [externalTargets, setExternalTargets] = useState<
    ExternalShareTargetDto[]
  >([]);

  const [selectedKind, setSelectedKind] = useState<TargetKind>("action");
  const [selectedTarget, setSelectedTarget] = useState<Target | null>(null);
  const [labelDraft, setLabelDraft] = useState<string>("");
  const [creating, setCreating] = useState(false);

  const [newCampaignName, setNewCampaignName] = useState<string>("");
  const [newCampaignPicture, setNewCampaignPicture] = useState<string | null>(
    null,
  );
  const [newCampaignPicturePreview, setNewCampaignPicturePreview] = useState<
    string | null
  >(null);
  const [creatingCampaign, setCreatingCampaign] = useState(false);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const ownerKeyRef = useRef<string | null>(null);
  const currentOwnerKey = owner ? ownerKey(owner) : null;
  useEffect(() => {
    ownerKeyRef.current = currentOwnerKey;
  }, [currentOwnerKey]);

  const { error, success, confirm } = useToast();

  const loadCampaigns = useCallback(async () => {
    try {
      const res = await campaignFindAllAdmin();
      setCampaigns(res.data ?? []);
    } catch (err) {
      console.error("Failed to load campaigns", err);
      error("Failed to load campaigns.");
    }
  }, [error]);

  useEffect(() => {
    void (async () => {
      try {
        const [actionsRes, targetsRes] = await Promise.all([
          actionsFindAllWithDraftsAdmin(),
          externalShareTargetsFindAllAdmin(),
        ]);
        setActions(actionsRes.data ?? []);
        setExternalTargets(targetsRes.data ?? []);
      } catch (err) {
        console.error("Failed to load actions / external targets", err);
        error("Failed to load actions or external targets.");
      }
    })();
    void loadCampaigns();
  }, [error, loadCampaigns]);

  const loadRows = useCallback(
    async (target: Owner) => {
      const key = ownerKey(target);
      setLoadingRows(true);
      try {
        const res = await loadShareUrlsForOwner(target);
        if (ownerKeyRef.current !== key) return;
        setRows(res.data ?? []);
      } catch (err) {
        if (ownerKeyRef.current !== key) return;
        console.error("Failed to load share urls for owner", err);
        error("Failed to load share links.");
      } finally {
        if (ownerKeyRef.current === key) setLoadingRows(false);
      }
    },
    [error],
  );

  useEffect(() => {
    if (!owner) {
      setRows([]);
      setExpanded({});
      setSelectedTarget(null);
      setLabelDraft("");
      setLoadingRows(false);
      return;
    }
    void loadRows(owner);
  }, [owner, loadRows]);

  const handleCampaignImageChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onloadend = async () => {
        const dataUrl = reader.result as string;
        setNewCampaignPicturePreview(dataUrl);
        try {
          const uploadResp = await imagesUploadImage({
            body: { file: dataUrl },
          });
          if (uploadResp.data) {
            setNewCampaignPicture(uploadResp.data.key);
            setNewCampaignPicturePreview(uploadResp.data.url);
          }
        } catch (err) {
          console.error("Failed to upload campaign image", err);
          error("Failed to upload image.");
          setNewCampaignPicturePreview(null);
        }
      };
      reader.readAsDataURL(file);
    },
    [error],
  );

  const handleCreateCampaign = useCallback(async () => {
    const name = newCampaignName.trim();
    if (!name) return;
    setCreatingCampaign(true);
    try {
      const res = await campaignCreateAdmin({
        body: { name, picture: newCampaignPicture ?? undefined },
      });
      const created = res.data;
      if (created) {
        setCampaigns((prev) => [created, ...prev]);
        setSelectedCampaignId(created.id);
        setNewCampaignName("");
        setNewCampaignPicture(null);
        setNewCampaignPicturePreview(null);
        success("Campaign created");
      }
    } catch (err) {
      console.error("Failed to create campaign", err);
      error("Failed to create campaign.");
    } finally {
      setCreatingCampaign(false);
    }
  }, [newCampaignName, newCampaignPicture, success, error]);

  const targetsForKind = useMemo((): Target[] => {
    switch (selectedKind) {
      case "action":
        return actions
          .filter((a) => !a.archived)
          .map((a) => ({ kind: "action", id: a.id, name: a.name }));
      case "external":
        return externalTargets.map((t) => ({
          kind: "external",
          id: t.id,
          name: t.name,
        }));
      case "invite":
        return [{ kind: "invite" }];
      default:
        throw new Error(`unknown target kind: ${selectedKind satisfies never}`);
    }
  }, [selectedKind, actions, externalTargets]);

  const handleKindChange = useCallback((kind: TargetKind) => {
    setSelectedKind(kind);
    // Invite has no target to choose, so select it implicitly.
    setSelectedTarget(kind === "invite" ? { kind: "invite" } : null);
  }, []);

  const groups = useMemo(() => {
    type Group = {
      key: string;
      target: Target;
      rows: ShareUrlAdminDto[];
      duplicateCount: number;
      mostRecent: number;
    };
    const byKey = new Map<string, Group>();
    for (const row of rows) {
      let target: Target | null = null;
      if (row.action) {
        target = { kind: "action", id: row.action.id, name: row.action.name };
      } else if (row.externalTarget) {
        target = {
          kind: "external",
          id: row.externalTarget.id,
          name: row.externalTarget.name,
        };
      } else if (row.kind === "invite") {
        target = { kind: "invite" };
      }
      if (!target) continue;
      const key = targetKey(target);
      const existing = byKey.get(key);
      if (existing) {
        existing.rows.push(row);
      } else {
        byKey.set(key, {
          key,
          target,
          rows: [row],
          duplicateCount: 0,
          mostRecent: 0,
        });
      }
    }
    for (const group of byKey.values()) {
      group.rows.sort((a, b) => {
        if (a.duplicate !== b.duplicate) return a.duplicate ? 1 : -1;
        return (
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      });
      group.duplicateCount = group.rows.filter((r) => r.duplicate).length;
      group.mostRecent = group.rows.reduce(
        (acc, r) => Math.max(acc, new Date(r.createdAt).getTime()),
        0,
      );
    }
    return [...byKey.values()].sort((a, b) => b.mostRecent - a.mostRecent);
  }, [rows]);

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

  const handleCopy = useCallback(
    async (url: string) => {
      try {
        await navigator.clipboard.writeText(url);
        success("Copied to clipboard");
      } catch (err) {
        console.error(err);
        error("Failed to copy");
      }
    },
    [success, error],
  );

  const handleToggleExpanded = useCallback((key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleUpdateLabel = useCallback(
    async (id: string, label: string): Promise<boolean> => {
      const requestKey = ownerKeyRef.current;
      try {
        const res = await shareUrlsUpdateLabelAdmin({
          path: { id },
          body: { label },
        });
        if (ownerKeyRef.current !== requestKey) return false;
        const updated = res.data;
        if (updated) {
          setRows((prev) => prev.map((r) => (r.id === id ? updated : r)));
          success("Label updated");
          return true;
        }
        return false;
      } catch (err) {
        if (ownerKeyRef.current !== requestKey) return false;
        console.error("Failed to update label", err);
        error("Failed to update label.");
        return false;
      }
    },
    [success, error],
  );

  const handleDelete = useCallback(
    async (id: string, event: React.MouseEvent<HTMLElement>) => {
      const ok = await confirm({
        message:
          "Delete this share link? Any URL already handed out using it will stop working.",
        confirmLabel: "Delete",
        cancelLabel: "Cancel",
        anchorEl: event.currentTarget,
        placement: "topleft",
      });
      if (!ok) return;
      const requestKey = ownerKeyRef.current;
      try {
        const res = await shareUrlsDeleteAdmin({ path: { id } });
        if (ownerKeyRef.current !== requestKey) return;
        if (res.error) {
          throw res.error;
        }
        setRows((prev) => prev.filter((r) => r.id !== id));
        success("Share link deleted");
      } catch (err) {
        if (ownerKeyRef.current !== requestKey) return;
        console.error("Failed to delete share link", err);
        error("Failed to delete share link.");
      }
    },
    [confirm, success, error],
  );

  const handleCreateDuplicate = useCallback(async () => {
    if (!owner || !selectedTarget) return;
    const requestKey = ownerKey(owner);
    const requestTarget = selectedTarget;
    setCreating(true);
    try {
      const trimmed = labelDraft.trim();
      const res = await shareUrlsCreateDuplicateAdmin({
        body: {
          ...ownerColumns(owner),
          ...targetColumns(requestTarget),
          label: trimmed || undefined,
        },
      });
      if (ownerKeyRef.current !== requestKey) return;
      const created = res.data;
      if (created) {
        setRows((prev) => [created, ...prev]);
        setExpanded((prev) => ({ ...prev, [targetKey(requestTarget)]: true }));
        setLabelDraft("");
        success("Duplicate link created");
      }
    } catch (err) {
      if (ownerKeyRef.current !== requestKey) return;
      console.error("Failed to create duplicate share link", err);
      error("Failed to create duplicate.");
    } finally {
      setCreating(false);
    }
  }, [owner, selectedTarget, labelDraft, success, error]);

  return (
    <div className="h-full p-5 pt-20 flex flex-col items-center gap-y-4">
      <title>Share Links - Admin</title>

      <div className="w-full max-w-4xl flex flex-col gap-3">
        <h2 className="text-2xl font-semibold mb-2">Share links</h2>
        <p className="text-sm text-zinc-500">
          View existing share links on behalf of a user or a campaign, and
          generate additional duplicate links so that distinct trackable URLs
          can be handed out to different recruits for the same action or
          external target. Campaigns are userless referral owners — new signups
          via a campaign link are attributed to the campaign as a source.
        </p>

        <Card className="w-full" style={CardStyle.White}>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-700">
                Owner kind
              </label>
              <select
                className="border border-zinc-300 rounded px-3 py-2 text-sm bg-white"
                value={ownerKind}
                onChange={(event) =>
                  setOwnerKind(event.target.value as OwnerKind)
                }
              >
                <option value="user">User</option>
                <option value="campaign">Campaign</option>
              </select>
            </div>

            {ownerKind === "user" ? (
              <UserSelect
                users={users}
                selectedUserIds={selectedUserIds}
                onChange={setSelectedUserIds}
                label="User"
                single
              />
            ) : (
              <CampaignPicker
                campaigns={campaigns}
                selectedCampaignId={selectedCampaignId}
                onSelect={setSelectedCampaignId}
                newCampaignName={newCampaignName}
                onNewCampaignNameChange={setNewCampaignName}
                onCreateCampaign={handleCreateCampaign}
                creatingCampaign={creatingCampaign}
                picturePreview={newCampaignPicturePreview}
                onPictureChange={handleCampaignImageChange}
              />
            )}
          </div>
        </Card>

        {owner?.type === "campaign" && selectedCampaign && (
          <Card className="w-full" style={CardStyle.White}>
            <div className="flex flex-col gap-1">
              <div className="flex flex-row items-center gap-2">
                {selectedCampaign.picture && (
                  <img
                    src={selectedCampaign.picture}
                    alt={`${selectedCampaign.name} avatar`}
                    className="w-8 h-8 rounded-full object-cover border border-zinc-200"
                  />
                )}
                <p className="font-semibold">Campaign signup link</p>
              </div>
              <p className="text-xs text-zinc-500">
                Bare signup link attributing new users to this campaign as a
                source.
              </p>
              <div className="flex flex-row items-center gap-2 mt-1">
                <p className="text-xs text-zinc-600 font-mono break-all flex-1">
                  {getReferralSignupUrl(getBaseUrl(), selectedCampaign.code)}
                </p>
                <Button
                  type="button"
                  color={ButtonColor.Light}
                  onClick={() =>
                    handleCopy(
                      getReferralSignupUrl(getBaseUrl(), selectedCampaign.code),
                    )
                  }
                  className="shrink-0"
                >
                  <Copy size={14} />
                  Copy
                </Button>
              </div>
            </div>
          </Card>
        )}

        {owner && (
          <>
            <Card className="w-full" style={CardStyle.White}>
              <div className="flex flex-col gap-3">
                <p className="font-semibold">Create duplicate link</p>
                <p className="text-xs text-zinc-500">
                  Pick any action or external target — duplicates can be created
                  for targets that {ownerName} hasn&apos;t shared yet too.
                </p>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-zinc-700">
                    Kind
                  </label>
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
                    A single trackable signup link will be created for{" "}
                    {ownerName}, attributing new signups to them as a source.
                  </p>
                ) : (
                  <TargetPicker
                    kind={selectedKind}
                    targets={targetsForKind}
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
              {loadingRows ? (
                <p className="text-sm text-zinc-500">Loading…</p>
              ) : groups.length === 0 ? (
                <Card className="w-full" style={CardStyle.White}>
                  <p className="text-sm text-zinc-500">
                    {ownerName} has no share links yet.
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
                    onCopy={handleCopy}
                    onUpdateLabel={handleUpdateLabel}
                    onDelete={handleDelete}
                  />
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const CampaignPicker: React.FC<{
  campaigns: CampaignDto[];
  selectedCampaignId: number | null;
  onSelect: (id: number | null) => void;
  newCampaignName: string;
  onNewCampaignNameChange: (value: string) => void;
  onCreateCampaign: () => void;
  creatingCampaign: boolean;
  picturePreview: string | null;
  onPictureChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}> = ({
  campaigns,
  selectedCampaignId,
  onSelect,
  newCampaignName,
  onNewCampaignNameChange,
  onCreateCampaign,
  creatingCampaign,
  picturePreview,
  onPictureChange,
}) => {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-zinc-700">Campaign</label>
        <select
          className="border border-zinc-300 rounded px-3 py-2 text-sm bg-white"
          value={selectedCampaignId ?? ""}
          onChange={(event) =>
            onSelect(event.target.value ? Number(event.target.value) : null)
          }
        >
          <option value="">Select a campaign…</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-zinc-700">
          Create a new campaign
        </label>
        <div className="flex flex-row items-center gap-2">
          <input
            type="text"
            className="border border-zinc-300 rounded px-3 py-2 text-sm flex-1"
            placeholder="Campaign name — e.g. Spring fundraiser"
            value={newCampaignName}
            onChange={(event) => onNewCampaignNameChange(event.target.value)}
            disabled={creatingCampaign}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onCreateCampaign();
              }
            }}
          />
          <Button
            type="button"
            color={ButtonColor.Blue}
            onClick={onCreateCampaign}
            disabled={creatingCampaign || !newCampaignName.trim()}
            className="shrink-0"
          >
            {creatingCampaign ? "Creating…" : "Create"}
          </Button>
        </div>
        <div className="flex flex-row items-center gap-3 mt-1">
          {picturePreview && (
            <img
              src={picturePreview}
              alt="Campaign avatar preview"
              className="w-10 h-10 rounded-full object-cover border border-zinc-200"
            />
          )}
          <input
            type="file"
            accept="image/*"
            onChange={onPictureChange}
            disabled={creatingCampaign}
            className="text-xs text-zinc-600"
          />
        </div>
      </div>
    </div>
  );
};

const TargetPicker: React.FC<{
  kind: TargetKind;
  targets: Target[];
  value: Target | null;
  onChange: (target: Target | null) => void;
  disabled?: boolean;
}> = ({ kind, targets, value, onChange, disabled }) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return targets;
    return targets.filter((t) => targetName(t).toLowerCase().includes(term));
  }, [targets, query]);

  const placeholder =
    kind === "action" ? "Search actions…" : "Search external targets…";

  return (
    <div className="flex flex-col gap-1 relative" ref={containerRef}>
      <label className="text-xs font-medium text-zinc-700">
        {targetKindLabel(kind)}
      </label>
      {value ? (
        <div className="flex flex-row items-center gap-2 border border-zinc-300 rounded px-3 py-2 text-sm bg-white">
          <span className="flex-1 truncate">{targetName(value)}</span>
          <button
            type="button"
            className="text-xs text-zinc-500 hover:text-zinc-900"
            onClick={() => onChange(null)}
            disabled={disabled}
          >
            Change
          </button>
        </div>
      ) : (
        <>
          <input
            type="text"
            className="border border-zinc-300 rounded px-3 py-2 text-sm"
            placeholder={placeholder}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            disabled={disabled}
          />
          {open && (
            <div className="absolute top-full left-0 right-0 mt-1 border border-zinc-200 rounded bg-white shadow-md max-h-72 overflow-y-auto z-10">
              {filtered.length === 0 ? (
                <p className="px-3 py-2 text-sm text-zinc-500">No matches.</p>
              ) : (
                filtered.map((t) => (
                  <button
                    type="button"
                    key={targetKey(t)}
                    className="w-full flex flex-row items-center gap-2 px-3 py-2 text-sm hover:bg-zinc-100 text-left"
                    onClick={() => {
                      onChange(t);
                      setQuery("");
                      setOpen(false);
                    }}
                  >
                    <span className="truncate">{targetName(t)}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

const GroupCard: React.FC<{
  target: Target;
  rows: ShareUrlAdminDto[];
  duplicateCount: number;
  expanded: boolean;
  onToggle: () => void;
  onCopy: (url: string) => void;
  onUpdateLabel: (id: string, label: string) => Promise<boolean>;
  onDelete: (id: string, event: React.MouseEvent<HTMLElement>) => void;
}> = ({
  target,
  rows,
  duplicateCount,
  expanded,
  onToggle,
  onCopy,
  onUpdateLabel,
  onDelete,
}) => {
  return (
    <Card className="w-full !p-0" style={CardStyle.White}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex flex-row items-center gap-2 px-4 py-3 hover:bg-zinc-50 text-left"
      >
        {expanded ? (
          <ChevronDown size={16} className="text-zinc-500 shrink-0" />
        ) : (
          <ChevronRight size={16} className="text-zinc-500 shrink-0" />
        )}
        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
          <h3 className="font-semibold truncate">{targetName(target)}</h3>
          <p className="text-xs text-zinc-500">{targetSubtitle(target)}</p>
        </div>
        <div className="flex flex-row gap-2 shrink-0 text-xs text-zinc-600">
          <span>
            {rows.length} link{rows.length === 1 ? "" : "s"}
          </span>
          {duplicateCount > 0 && (
            <span className="text-blue-700 font-semibold">
              {duplicateCount} duplicate{duplicateCount === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </button>
      {expanded && (
        <div className="flex flex-col px-4 pb-3">
          {rows.map((row) => (
            <ShareUrlRow
              key={row.id}
              row={row}
              onCopy={onCopy}
              onUpdateLabel={onUpdateLabel}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </Card>
  );
};

const ShareUrlRow: React.FC<{
  row: ShareUrlAdminDto;
  onCopy: (url: string) => void;
  onUpdateLabel: (id: string, label: string) => Promise<boolean>;
  onDelete: (id: string, event: React.MouseEvent<HTMLElement>) => void;
}> = ({ row, onCopy, onUpdateLabel, onDelete }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(row.label ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(row.label ?? "");
  }, [row.label, editing]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    const ok = await onUpdateLabel(row.id, draft);
    setSaving(false);
    if (ok) setEditing(false);
  }, [onUpdateLabel, row.id, draft]);

  const handleCancel = useCallback(() => {
    setDraft(row.label ?? "");
    setEditing(false);
  }, [row.label]);

  return (
    <div className="flex flex-row items-start gap-3 py-2 border-t border-zinc-100 first:border-t-0">
      <div className="shrink-0 pt-0.5">
        <span
          className={cn(
            "text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded",
            row.duplicate
              ? "text-blue-700 bg-blue-100"
              : "text-zinc-700 bg-zinc-100",
          )}
        >
          {row.duplicate ? "duplicate" : "canonical"}
        </span>
      </div>
      <div className="flex flex-col gap-1 min-w-0 flex-1">
        {editing ? (
          <div className="flex flex-row items-center gap-2">
            <input
              type="text"
              className="flex-1 border border-zinc-300 rounded px-2 py-1 text-sm"
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
            <Button
              type="button"
              color={ButtonColor.Blue}
              onClick={handleSave}
              disabled={saving}
              className="shrink-0"
            >
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button
              type="button"
              color={ButtonColor.Light}
              onClick={handleCancel}
              disabled={saving}
              className="shrink-0"
            >
              Cancel
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="group flex flex-row items-center gap-1.5 text-left self-start max-w-full"
            aria-label="Edit label"
          >
            <span
              className={cn(
                "text-sm truncate",
                row.label
                  ? "font-medium text-zinc-900 group-hover:text-zinc-700"
                  : "italic text-zinc-400 group-hover:text-zinc-600",
              )}
            >
              {row.label || "No label"}
            </span>
            <Pencil
              size={12}
              className="shrink-0 text-zinc-400 group-hover:text-zinc-700"
            />
          </button>
        )}
        <p className="text-xs text-zinc-600 font-mono break-all">{row.url}</p>
        {row.sid && (
          <p className="text-[11px] text-zinc-400 font-mono">{row.sid}</p>
        )}
        {row.kind === "invite" && (
          <p className="text-xs font-medium text-green">
            {row.signupCount} {row.signupCount === 1 ? "use" : "uses"}
          </p>
        )}
      </div>
      <Button
        type="button"
        color={ButtonColor.Light}
        onClick={() => onCopy(row.url)}
        className="shrink-0"
      >
        <Copy size={14} />
        Copy
      </Button>
      <Button
        type="button"
        color={ButtonColor.Red}
        onClick={(event) => onDelete(row.id, event)}
        className="shrink-0"
      >
        <Trash2 size={14} />
        Delete
      </Button>
    </div>
  );
};

export default ShareLinksPage;
