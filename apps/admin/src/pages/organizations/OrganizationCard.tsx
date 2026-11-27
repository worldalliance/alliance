import type {
  AdminWaitlistLinkDto,
  CampaignDto,
  CommunityDto,
} from "@alliance/shared/client/types.gen";
import { Building2 } from "lucide-react";
import { useState } from "react";
import InlineTextInput from "../../components/InlineTextInput";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { countOf } from "../../lib/formatNumber";
import {
  useUpdateCampaignAdmin,
  useUploadCampaignPictureAdmin,
} from "../../lib/useCampaignsAdmin";
import Badge, { BadgeTone } from "../../ui/Badge";
import { cn } from "../../ui/cn";
import { FileInput } from "../../ui/FileInput";
import { Select } from "../../ui/Select";
import { controlClass } from "../../ui/styles";
import { Field } from "../../ui/templates/Form";
import { Panel } from "../../ui/templates/Overview";
import { OrganizationLinks } from "./OrganizationLinks";

enum OrganizationField {
  Name = "name",
  Group = "group",
  Logo = "logo",
}

export function OrganizationCard({
  organization,
  groups,
  takenGroupIds,
  links,
}: {
  organization: CampaignDto;
  groups: readonly CommunityDto[];
  takenGroupIds: ReadonlySet<number>;
  links: readonly AdminWaitlistLinkDto[];
}) {
  const [problem, setProblem] = useState<{
    field: OrganizationField;
    message: string;
  } | null>(null);
  // Cleared once the upload settles, so the same file can be chosen again.
  const [logo, setLogo] = useState<readonly File[]>([]);
  const problemOf = (field: OrganizationField) =>
    problem?.field === field ? problem.message : null;

  const update = useUpdateCampaignAdmin({ onError: () => {} });
  const uploadLogo = useUploadCampaignPictureAdmin({
    onSuccess: (result) => {
      if (!result.ok) {
        setProblem({ field: OrganizationField.Logo, message: result.error });
      }
    },
    onError: (error) =>
      setProblem({
        field: OrganizationField.Logo,
        message: adminRefusalMessage(error, "Couldn't upload the logo."),
      }),
  });
  const busy = update.isPending || uploadLogo.isPending;

  const save = (params: {
    field: OrganizationField.Name | OrganizationField.Group;
    body: { name: string } | { communityId: number | null };
    fallback: string;
    onSettled?: () => void;
  }) => {
    setProblem(null);
    update.mutate(
      { id: organization.id, body: params.body },
      {
        onError: (error) =>
          setProblem({
            field: params.field,
            message: adminRefusalMessage(error, params.fallback),
          }),
        onSettled: params.onSettled,
      },
    );
  };

  const entries = links.reduce((total, link) => total + link.entryCount, 0);
  return (
    <Panel
      title={organization.name}
      description={
        <span className="flex items-center gap-2">
          {organization.communityId === null && (
            <Badge tone={BadgeTone.Warning}>No group</Badge>
          )}
          {countOf(links.length, "waitlist link")} · {countOf(entries, "entry")}
        </span>
      }
      flush
    >
      <div className="flex flex-wrap items-start gap-x-6 gap-y-4 p-card">
        <div className="flex items-start gap-3">
          <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-md border border-line bg-surface-2">
            {organization.picture ? (
              <img
                src={organization.picture}
                alt=""
                className="size-full object-cover"
              />
            ) : (
              <Building2 aria-hidden="true" className="size-5 text-fg-muted" />
            )}
          </span>
          <Field
            label="Logo"
            help={uploadLogo.isPending ? "Uploading…" : "Saved once chosen."}
            error={problemOf(OrganizationField.Logo)}
            className="w-64"
          >
            {(control) => (
              <FileInput
                {...control}
                accept="image/*"
                value={logo}
                disabled={busy}
                onChange={([file]) => {
                  if (!file) return;
                  setProblem(null);
                  setLogo([file]);
                  uploadLogo.mutate(
                    { id: organization.id, file },
                    { onSettled: () => setLogo([]) },
                  );
                }}
              />
            )}
          </Field>
        </div>
        <Field
          label="Name"
          help="Saved when you leave the field."
          error={problemOf(OrganizationField.Name)}
          className="w-72"
        >
          {(control) => (
            <InlineTextInput
              {...control}
              aria-label="Organization name"
              className={cn(controlClass, "h-control")}
              value={organization.name}
              disabled={busy}
              onSave={(name, done) =>
                save({
                  field: OrganizationField.Name,
                  body: { name },
                  fallback: "Couldn't rename the organization.",
                  onSettled: done,
                })
              }
            />
          )}
        </Field>
        <Field
          label="Group"
          // Each waitlist invite copies the organization's group when it is issued
          // (waitlist-invite.service), and contract.service skips a full group at signup.
          help={
            organization.communityId === null
              ? "No group assigned. People invited from now on will await staff placement. People already invited keep the group they were invited with."
              : "People invited from now on join this group if it has room when they sign up; otherwise they await staff placement. People already invited keep the group they were invited with."
          }
          error={problemOf(OrganizationField.Group)}
          className="w-72"
        >
          {(control) => (
            <Select
              {...control}
              value={organization.communityId ?? ""}
              disabled={busy}
              onChange={(event) =>
                save({
                  field: OrganizationField.Group,
                  body: {
                    communityId: event.target.value
                      ? Number(event.target.value)
                      : null,
                  },
                  fallback: "Couldn't change the group.",
                })
              }
            >
              <option value="">No group</option>
              {groups.map((group) => (
                <option
                  key={group.id}
                  value={group.id}
                  disabled={takenGroupIds.has(group.id)}
                >
                  {group.name}
                  {takenGroupIds.has(group.id)
                    ? " (another organization's)"
                    : ""}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <OrganizationLinks organizationId={organization.id} links={links} />
    </Panel>
  );
}
