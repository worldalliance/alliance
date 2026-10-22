import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import React, { useMemo, useState } from "react";
import OrganizationCard from "../components/organizations/OrganizationCard";
import { adminRefusalMessage } from "../lib/adminRefusal";
import { isOrganization } from "../lib/isOrganization";
import {
  campaignsLoadFailed,
  useCampaignsAdmin,
  useCreateCampaignAdmin,
  useUpdateCampaignAdmin,
} from "../lib/useCampaignsAdmin";
import { useCommunitiesAdmin } from "../lib/useCommunitiesAdmin";
import { useRefusalToast } from "../lib/useRefusalToast";
import {
  useWaitlistLinksAdmin,
  waitlistLinksLoadFailed,
} from "../lib/useWaitlistLinksAdmin";

const OrganizationsPage: React.FC = () => {
  const refusalToast = useRefusalToast();
  const campaigns = useCampaignsAdmin();
  const communities = useCommunitiesAdmin();
  const links = useWaitlistLinksAdmin();

  const [newName, setNewName] = useState("");
  const [designateId, setDesignateId] = useState("");

  const organizations = useMemo(
    () => (campaigns.data ?? []).filter(isOrganization),
    [campaigns.data],
  );
  const ordinaryCampaigns = useMemo(
    () => (campaigns.data ?? []).filter((c) => !isOrganization(c)),
    [campaigns.data],
  );

  const create = useCreateCampaignAdmin({
    onSuccess: () => setNewName(""),
    onError: (err) => refusalToast(err, "Could not create the organization."),
  });

  const designate = useUpdateCampaignAdmin({
    onSuccess: () => setDesignateId(""),
    onError: (err) => refusalToast(err, "Could not designate the campaign."),
  });

  const loadError = campaigns.error
    ? adminRefusalMessage(campaigns.error, campaignsLoadFailed)
    : communities.error
      ? adminRefusalMessage(communities.error, "Unable to load groups.")
      : links.error
        ? adminRefusalMessage(links.error, waitlistLinksLoadFailed)
        : null;
  const loaded = campaigns.data && communities.data && links.data;

  return (
    <div className="p-5 space-y-4">
      <title>Organizations - Admin</title>
      <div>
        <h1 className="text-lg font-bold text-zinc-900">Organizations</h1>
        <p className="text-sm text-zinc-600 mt-1 max-w-3xl">
          Each organization can own one accountability group and any number of
          waitlist links. Entries through a link, or through the personal link
          of someone who joined through one, are attributed to it.
        </p>
      </div>

      <div className="flex flex-wrap gap-6 items-end">
        <form
          className="flex gap-2 items-end"
          onSubmit={(e) => {
            e.preventDefault();
            const name = newName.trim();
            if (name) create.mutate({ name, kind: "organization" });
          }}
        >
          <label className="flex flex-col text-sm text-zinc-700">
            New organization
            <input
              className="border border-zinc-300 rounded px-2 py-1 mt-1"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              readOnly={create.isPending}
              placeholder="Name"
            />
          </label>
          <Button
            color={ButtonColor.Black}
            size="small"
            type="submit"
            disabled={!newName.trim() || create.isPending}
          >
            Create
          </Button>
        </form>

        {ordinaryCampaigns.length > 0 && (
          <form
            className="flex gap-2 items-end"
            onSubmit={(e) => {
              e.preventDefault();
              if (designateId)
                designate.mutate({
                  id: Number(designateId),
                  body: { kind: "organization" },
                });
            }}
          >
            <label className="flex flex-col text-sm text-zinc-700">
              Existing campaign
              <select
                className="border border-zinc-300 rounded px-2 py-1 mt-1"
                value={designateId}
                onChange={(e) => setDesignateId(e.target.value)}
              >
                <option value="">Choose a campaign</option>
                {ordinaryCampaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </option>
                ))}
              </select>
            </label>
            <Button
              color={ButtonColor.White}
              size="small"
              type="submit"
              disabled={!designateId || designate.isPending}
            >
              Make organization
            </Button>
          </form>
        )}
      </div>

      {loadError && <p className="text-sm text-red-500">{loadError}</p>}
      {!loaded ? (
        !loadError && <p className="text-sm text-zinc-500">Loading…</p>
      ) : organizations.length === 0 ? (
        <p className="text-sm text-zinc-500">No organizations yet.</p>
      ) : (
        organizations.map((organization) => (
          <OrganizationCard
            key={organization.id}
            organization={organization}
            communities={communities.data}
            takenCommunityIds={
              new Set(
                organizations.flatMap((other) =>
                  other.id !== organization.id && other.communityId !== null
                    ? [other.communityId]
                    : [],
                ),
              )
            }
            links={links.data.filter(
              (link) => link.organizationId === organization.id,
            )}
          />
        ))
      )}
    </div>
  );
};

export default OrganizationsPage;
