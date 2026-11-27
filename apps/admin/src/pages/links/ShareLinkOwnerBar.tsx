import type { CampaignDto } from "@alliance/shared/client/types.gen";
import { getReferralSignupUrl } from "@alliance/shared/lib/inviteUrls";
import { getInviteBaseUrl } from "@alliance/sharedweb/lib/config";
import type { UseQueryResult } from "@tanstack/react-query";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import Button, { ButtonVariant } from "../../ui/Button";
import { CopyField } from "../../ui/CopyField";
import { Select } from "../../ui/Select";
import { Field } from "../../ui/templates/Form";
import UserSelect, { type UserSelectUser } from "../../ui/UserSelect";
import { OwnerKind } from "./useShareLinkOwner";

const OWNER_KIND_LABEL: Record<OwnerKind, string> = {
  [OwnerKind.Member]: "Member",
  [OwnerKind.Campaign]: "Campaign",
};

export function ShareLinkOwnerBar({
  kind,
  id,
  onKindChange,
  onIdChange,
  users,
  campaigns,
  onNewCampaign,
}: {
  kind: OwnerKind;
  id: number | null;
  onKindChange: (kind: OwnerKind) => void;
  onIdChange: (id: number | null) => void;
  users: {
    users: UserSelectUser[];
    isLoading: boolean;
    isLoadingError: boolean;
  };
  campaigns: UseQueryResult<CampaignDto[]>;
  onNewCampaign: () => void;
}) {
  const campaign =
    kind === OwnerKind.Campaign
      ? campaigns.data?.find((c) => c.id === id)
      : undefined;
  const signupUrl =
    campaign && getReferralSignupUrl(getInviteBaseUrl(), campaign.code);
  return (
    <div className="flex shrink-0 flex-col gap-3 border-b border-line px-page py-bar">
      <div className="flex flex-wrap items-start gap-3">
        <Field label="Links of" className="w-40">
          {(control) => (
            <Select
              {...control}
              value={kind}
              onChange={(event) =>
                onKindChange(
                  event.target.value === OwnerKind.Campaign
                    ? OwnerKind.Campaign
                    : OwnerKind.Member,
                )
              }
            >
              {Object.values(OwnerKind).map((value) => (
                <option key={value} value={value}>
                  {OWNER_KIND_LABEL[value]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {kind === OwnerKind.Member ? (
          <div className="w-80">
            <UserSelect
              label="Member"
              single
              users={users.users}
              loading={users.isLoading}
              loadFailed={users.isLoadingError}
              selectedUserIds={id === null ? [] : [id]}
              onChange={(ids) => onIdChange(ids[0] ?? null)}
            />
          </div>
        ) : (
          <>
            <Field
              label="Campaign"
              className="w-80"
              error={
                campaigns.isLoadingError
                  ? adminRefusalMessage(
                      campaigns.error,
                      "Couldn't load campaigns.",
                    )
                  : null
              }
            >
              {(control) => (
                <Select
                  {...control}
                  value={id ?? ""}
                  disabled={campaigns.isPending}
                  onChange={(event) =>
                    onIdChange(
                      event.target.value ? Number(event.target.value) : null,
                    )
                  }
                >
                  <option value="">
                    {campaigns.isPending
                      ? "Loading campaigns…"
                      : "Choose a campaign…"}
                  </option>
                  {(campaigns.data ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <div className="flex flex-col gap-1.5">
              {/* Stands in for a field's label, so the button lines up with the controls. */}
              <span aria-hidden="true" className="invisible font-medium">
                &nbsp;
              </span>
              <Button variant={ButtonVariant.Default} onClick={onNewCampaign}>
                New campaign…
              </Button>
            </div>
          </>
        )}
      </div>
      {campaign && signupUrl && (
        <div className="flex max-w-2xl items-end gap-3">
          {campaign.picture && (
            <img
              src={campaign.picture}
              alt=""
              className="mb-2 size-6 shrink-0 rounded-full border border-line object-cover"
            />
          )}
          <div className="min-w-0 flex-1">
            <CopyField label="Campaign signup link" value={signupUrl} />
          </div>
        </div>
      )}
    </div>
  );
}
