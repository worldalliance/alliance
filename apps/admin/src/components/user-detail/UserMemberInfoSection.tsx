import {
  UserAdminDetailDto,
  UserAdminInvitedByDto,
} from "@alliance/shared/client/types.gen";
import { Globe, MapPin, UserPlus } from "lucide-react";
import { Link } from "react-router";
import { humanize } from "./humanize";

export default function UserMemberInfoSection({
  user,
}: {
  user: UserAdminDetailDto;
}) {
  return (
    <section className="border border-zinc-200 rounded p-3">
      <h2 className="text-sm font-semibold text-zinc-700 mb-2">Member Info</h2>
      <div className="space-y-3 text-sm">
        <div>
          <p className="text-xs font-medium text-zinc-500 mb-1">Bio</p>
          {user.profileDescription?.trim() ? (
            <p className="text-zinc-800 whitespace-pre-wrap break-words">
              {user.profileDescription}
            </p>
          ) : (
            <p className="text-zinc-500 text-xs">No bio provided.</p>
          )}
        </div>

        <div className="space-y-2">
          <InfoRow icon={<MapPin size={14} />} label="Location">
            {formatUserLocation(user) ?? "No location provided"}
          </InfoRow>
          <InfoRow icon={<UserPlus size={14} />} label="Invited by">
            {formatInvitedBy(user)}
          </InfoRow>
          <InfoRow icon={<Globe size={14} />} label="Public profile">
            {user.shareInfoPublicly ? "Shared publicly" : "Private"}
          </InfoRow>
        </div>

        <dl className="grid grid-cols-1 gap-2 pt-2 border-t border-zinc-100 text-xs">
          <DetailItem label="Anonymous">
            {user.anonymous ? "Yes" : "No"}
          </DetailItem>
          <DetailItem label="Email with leads">
            {user.shareEmailWithCommunityLead ? "Shared" : "Private"}
          </DetailItem>
          <DetailItem label="Phone with leads">
            {user.sharePhoneNumberWithCommunityLead ? "Shared" : "Private"}
          </DetailItem>
          <DetailItem label="Form responses">
            {humanize(user.formDataPreference)}
          </DetailItem>
          <DetailItem label="Reminder time">
            {formatReminderTime(user)}
          </DetailItem>
          <DetailItem label="Time zone">
            {user.timeZone ?? "Not provided"}
          </DetailItem>
          {user.clusterId !== null && (
            <DetailItem label="Cluster">#{user.clusterId}</DetailItem>
          )}
        </dl>
      </div>
    </section>
  );
}

function InfoRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="text-zinc-400 mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="font-medium text-zinc-500">{label}</p>
        <div className="text-zinc-800 break-words">{children}</div>
      </div>
    </div>
  );
}

function DetailItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="text-right text-zinc-800 break-words">{children}</dd>
    </div>
  );
}

function formatUserLocation(user: UserAdminDetailDto) {
  const parts = [
    user.location.cityName,
    user.location.countryName ?? user.location.countryCode,
  ].filter(Boolean);
  if (parts.length > 0) {
    return parts.join(", ");
  }
  return user.location.customCityString?.trim() || null;
}

function formatInvitedBy(user: UserAdminDetailDto) {
  const invitedBy = user.invitedBy;
  if (!invitedBy) {
    return "No invite attribution";
  }

  const source = formatInviteSource(invitedBy);
  const labelWithSource = `${invitedBy.label}${source}`;

  switch (invitedBy.kind) {
    case "user":
      return invitedBy.userId ? (
        <>
          <Link
            to={`/member/${invitedBy.userId}`}
            className="text-blue-600 hover:underline"
          >
            {invitedBy.label}
          </Link>
          {source}
        </>
      ) : (
        labelWithSource
      );
    case "campaign":
      return labelWithSource;
    case "unknown":
      return invitedBy.label;
    default:
      throw new Error(
        `unknown invited by kind: ${invitedBy.kind satisfies never}`,
      );
  }
}

function formatInviteSource(invitedBy: UserAdminInvitedByDto) {
  switch (invitedBy.referralSource) {
    case "onetime_invite":
      return " via individual single-use invite link";
    case "invite_share_link":
      return ` via group invite link${
        invitedBy.inviteLinkLabel ? ` “${invitedBy.inviteLinkLabel}”` : ""
      }`;
    case "referral_link":
    case "action_share_link":
    case "external_share_link":
    case "campaign":
    case "none":
      return ` via ${humanize(invitedBy.referralSource)}`;
    case undefined:
      return "";
    default:
      throw new Error(
        `unknown referral source: ${invitedBy.referralSource satisfies never}`,
      );
  }
}

function formatReminderTime(user: UserAdminDetailDto) {
  if (!user.preferredReminderTime) {
    return "Not provided";
  }
  return user.timeZone
    ? `${user.preferredReminderTime} ${user.timeZone}`
    : user.preferredReminderTime;
}
