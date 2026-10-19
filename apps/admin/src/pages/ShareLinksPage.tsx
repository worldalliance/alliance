// eslint-disable-next-line api-client/named-hooks-only -- file upload; its result is used once, not cached
import { imagesUploadImage } from "@alliance/shared/client";
import { getReferralSignupUrl } from "@alliance/shared/lib/inviteUrls";
import { CardStyle } from "@alliance/shared/styles/card";
import { copyToClipboard } from "@alliance/sharedweb/lib/clipboard";
import { getInviteBaseUrl } from "@alliance/sharedweb/lib/config";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import UserSelect, {
  useSelectableUsers,
} from "@alliance/sharedweb/ui/UserSelect";
import { Copy } from "lucide-react";
import React, { useCallback, useMemo, useState } from "react";
import CampaignPicker from "../components/share-links/CampaignPicker";
import ShareLinkManager, {
  type Owner,
} from "../components/share-links/ShareLinkManager";
import { adminRefusalMessage } from "../lib/adminRefusal";
import {
  useCampaignsAdmin,
  useCreateCampaignAdmin,
} from "../lib/useCampaignsAdmin";
import { useRefusalToast } from "../lib/useRefusalToast";
import { type ShareLinkOwner } from "../lib/useShareLinksAdmin";

type OwnerKind = ShareLinkOwner["type"];

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

  const [newCampaignName, setNewCampaignName] = useState<string>("");
  const [newCampaignPicture, setNewCampaignPicture] = useState<string | null>(
    null,
  );
  const [newCampaignPicturePreview, setNewCampaignPicturePreview] = useState<
    string | null
  >(null);

  const { error, success } = useToast();
  const refusalToast = useRefusalToast();

  const handleCampaignImageChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onloadend = async () => {
        const dataUrl = reader.result as string;
        setNewCampaignPicturePreview(dataUrl);
        try {
          const { data } = await imagesUploadImage({
            body: { file: dataUrl },
            throwOnError: true,
          });
          setNewCampaignPicture(data.key);
          setNewCampaignPicturePreview(data.url);
        } catch (err) {
          refusalToast(err, "Failed to upload image.");
          setNewCampaignPicturePreview(null);
        }
      };
      reader.readAsDataURL(file);
    },
    [refusalToast],
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

        <ShareLinkManager owner={owner} onCopy={handleCopy} />
      </div>
    </div>
  );
};

export default ShareLinksPage;
