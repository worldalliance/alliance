import { imagesUploadImage } from "@alliance/shared/client";
import { getReferralSignupUrl } from "@alliance/shared/lib/inviteUrls";
import { useActionsAdmin } from "@alliance/shared/lib/useActionsAdmin";
import { CardStyle } from "@alliance/shared/styles/card";
import { copyToClipboard } from "@alliance/sharedweb/lib/clipboard";
import { getInviteBaseUrl } from "@alliance/sharedweb/lib/config";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import { ToastPlacement, useToast } from "@alliance/sharedweb/ui/ToastProvider";
import UserSelect, {
  useSelectableUsers,
} from "@alliance/sharedweb/ui/UserSelect";
import { Copy } from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import CampaignPicker from "../components/share-links/CampaignPicker";
import GroupCard from "../components/share-links/GroupCard";
import TargetPicker from "../components/share-links/TargetPicker";
import {
  groupShareLinks,
  type Target,
  targetColumns,
  targetKey,
  type TargetKind,
} from "../components/share-links/shareLinkTargets";
import { actionsLoadError } from "../lib/actionsLoadError";
import { adminRefusalMessage } from "../lib/adminRefusal";
import {
  useCampaignsAdmin,
  useCreateCampaignAdmin,
} from "../lib/useCampaignsAdmin";
import {
  externalShareTargetsLoadError,
  useExternalShareTargetsAdmin,
} from "../lib/useExternalShareTargetsAdmin";
import { useRefusalToast } from "../lib/useRefusalToast";
import {
  type ShareLinkOwner,
  shareLinksLoadError,
  useShareLinksAdmin,
} from "../lib/useShareLinksAdmin";

type OwnerKind = ShareLinkOwner["type"];

type Owner = ShareLinkOwner & { name: string };

const ownerKey = (o: Owner): string => `${o.type}-${o.id}`;

const ShareLinksPage: React.FC = () => {
  const {
    users,
    isLoading: usersLoading,
    isLoadingError: usersError,
  } = useSelectableUsers();
  const [ownerKind, setOwnerKind] = useState<OwnerKind>("user");

  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const selectedUserId = selectedUserIds[0] ?? null;
  const selectedUser = users.find((u) => u.id === selectedUserId);

  const campaigns = useCampaignsAdmin();
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(
    null,
  );
  const selectedCampaign =
    campaigns.data?.find((c) => c.id === selectedCampaignId) ?? null;

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

  const [newCampaignName, setNewCampaignName] = useState<string>("");
  const [newCampaignPicture, setNewCampaignPicture] = useState<string | null>(
    null,
  );
  const [newCampaignPicturePreview, setNewCampaignPicturePreview] = useState<
    string | null
  >(null);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const ownerKeyRef = useRef<string | null>(null);
  const currentOwnerKey = owner ? ownerKey(owner) : null;
  useEffect(() => {
    ownerKeyRef.current = currentOwnerKey;
  }, [currentOwnerKey]);

  const { error, success, confirm } = useToast();
  const refusalToast = useRefusalToast();

  useEffect(() => {
    if (owner) return;
    setExpanded({});
    setSelectedTarget(null);
    setLabelDraft("");
  }, [owner]);

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

  const createCampaign = useCreateCampaignAdmin({
    onSuccess: (created) => {
      setSelectedCampaignId(created.id);
      setNewCampaignName("");
      setNewCampaignPicture(null);
      setNewCampaignPicturePreview(null);
      success("Campaign created");
    },
    onError: (err) => refusalToast(err, "Failed to create campaign."),
  });

  const handleCreateCampaign = () => {
    const name = newCampaignName.trim();
    if (name)
      createCampaign.mutate({ name, picture: newCampaignPicture ?? undefined });
  };

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

  const handleCopy = useCallback(
    async (url: string) => {
      if (await copyToClipboard(url)) {
        success("Copied to clipboard");
      } else {
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
                loading={usersLoading}
                loadFailed={usersError}
                label="User"
                single
              />
            ) : (
              <CampaignPicker
                campaigns={campaigns.data ?? []}
                loadError={
                  campaigns.error &&
                  adminRefusalMessage(
                    campaigns.error,
                    "Failed to load campaigns.",
                  )
                }
                selectedCampaignId={selectedCampaignId}
                onSelect={setSelectedCampaignId}
                newCampaignName={newCampaignName}
                onNewCampaignNameChange={setNewCampaignName}
                onCreateCampaign={handleCreateCampaign}
                creatingCampaign={createCampaign.isPending}
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
                  {getReferralSignupUrl(
                    getInviteBaseUrl(),
                    selectedCampaign.code,
                  )}
                </p>
                <Button
                  type="button"
                  color={ButtonColor.Light}
                  onClick={() =>
                    handleCopy(
                      getReferralSignupUrl(
                        getInviteBaseUrl(),
                        selectedCampaign.code,
                      ),
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

export default ShareLinksPage;
