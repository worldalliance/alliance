import type {
  AdminWaitlistLinkDto,
  CampaignDto,
  CommunityDto,
} from "@alliance/shared/client/types.gen";
import { CardStyle } from "@alliance/shared/styles/card";
import Card from "@alliance/sharedweb/ui/Card";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { Building2, ImageUp } from "lucide-react";
import React from "react";
import {
  useUpdateCampaignAdmin,
  useUploadCampaignPictureAdmin,
} from "../../lib/useCampaignsAdmin";
import { useRefusalToast } from "../../lib/useRefusalToast";
import InlineTextInput from "../InlineTextInput";
import OrganizationLinks from "./OrganizationLinks";

type OrganizationCardProps = {
  organization: CampaignDto;
  communities: CommunityDto[];
  takenCommunityIds: Set<number>;
  links: AdminWaitlistLinkDto[];
};

const OrganizationCard: React.FC<OrganizationCardProps> = ({
  organization,
  communities,
  takenCommunityIds,
  links,
}) => {
  const refusalToast = useRefusalToast();
  const { error: toastError } = useToast();

  const update = useUpdateCampaignAdmin({
    onError: (err) => refusalToast(err, "Could not update the organization."),
  });

  const uploadLogo = useUploadCampaignPictureAdmin({
    onSuccess: (result) => {
      if (!result.ok) toastError(result.error);
    },
    onError: (err) => refusalToast(err, "Could not upload the logo."),
  });

  const busy = update.isPending || uploadLogo.isPending;

  return (
    <Card style={CardStyle.White}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <label
            className="relative w-14 h-14 rounded-md border border-zinc-200 bg-zinc-50 flex items-center justify-center overflow-hidden cursor-pointer group"
            title="Upload logo"
          >
            {organization.picture ? (
              <img
                src={organization.picture}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <Building2 size={22} className="text-zinc-400" />
            )}
            <span className="absolute inset-0 hidden group-hover:flex items-center justify-center bg-black/40 text-white">
              <ImageUp size={18} />
            </span>
            <input
              type="file"
              accept="image/*"
              aria-label="Upload logo"
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadLogo.mutate({ id: organization.id, file });
                e.target.value = "";
              }}
            />
          </label>

          <InlineTextInput
            aria-label="Organization name"
            className="text-base font-semibold border border-transparent hover:border-zinc-300 focus:border-zinc-400 rounded px-2 py-1 flex-1 min-w-48 max-w-md"
            value={organization.name}
            disabled={busy}
            onSave={(name, done) =>
              update.mutate(
                { id: organization.id, body: { name } },
                { onSettled: done },
              )
            }
          />

          <label className="flex items-center gap-2 text-sm text-zinc-700">
            Group
            <select
              className="border border-zinc-300 rounded px-2 py-1"
              value={organization.communityId ?? ""}
              disabled={busy}
              onChange={(e) =>
                update.mutate({
                  id: organization.id,
                  body: {
                    communityId: e.target.value ? Number(e.target.value) : null,
                  },
                })
              }
            >
              <option value="">No group</option>
              {communities.map((community) => (
                <option
                  key={community.id}
                  value={community.id}
                  disabled={takenCommunityIds.has(community.id)}
                >
                  {community.name}
                  {takenCommunityIds.has(community.id)
                    ? " (another organization's)"
                    : ""}
                </option>
              ))}
            </select>
          </label>
        </div>

        {organization.communityId === null && (
          <p className="text-sm text-amber-700">
            No group assigned. People mobilized from this organization will
            await staff placement.
          </p>
        )}

        <OrganizationLinks organizationId={organization.id} links={links} />
      </div>
    </Card>
  );
};

export default OrganizationCard;
