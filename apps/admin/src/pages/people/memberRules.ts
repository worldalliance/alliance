import type {
  ContractEventType,
  UserAdminDetailDto,
  UserAdminInvitedByDto,
} from "@alliance/shared/client/types.gen";
import { BadgeTone } from "../../ui/Badge";

export enum ContractStanding {
  Signed = "signed",
  Suspended = "suspended",
  NotSigned = "not_signed",
}

export const CONTRACT_STANDING: Record<
  ContractStanding,
  { label: string; tone: BadgeTone }
> = {
  [ContractStanding.Signed]: { label: "Signed", tone: BadgeTone.Success },
  [ContractStanding.Suspended]: { label: "Suspended", tone: BadgeTone.Danger },
  [ContractStanding.NotSigned]: {
    label: "Not signed",
    tone: BadgeTone.Neutral,
  },
};

export const EVENT_STANDING: Record<ContractEventType, ContractStanding> = {
  signed: ContractStanding.Signed,
  suspended: ContractStanding.Suspended,
};

export const contractStanding = (
  user: Pick<UserAdminDetailDto, "lastContractEvent">,
): ContractStanding =>
  user.lastContractEvent
    ? EVENT_STANDING[user.lastContractEvent.type]
    : ContractStanding.NotSigned;

export enum MemberRole {
  Staff = "staff",
  Ambassador = "ambassador",
  Admin = "admin",
}

export const MEMBER_ROLES = [
  MemberRole.Staff,
  MemberRole.Ambassador,
  MemberRole.Admin,
] as const;

export const ROLE_LABEL: Record<MemberRole, string> = {
  [MemberRole.Staff]: "Staff",
  [MemberRole.Ambassador]: "Ambassador",
  [MemberRole.Admin]: "Admin",
};

export const memberRoles = (user: Record<MemberRole, boolean>): MemberRole[] =>
  MEMBER_ROLES.filter((role) => user[role]);

/** "started_task" reads "Started task". */
export const sentenceCase = (value: string) => {
  const words = value.split("_").join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

export const memberLocation = (
  user: Pick<UserAdminDetailDto, "location">,
): string | null => {
  const parts = [
    user.location.cityName,
    user.location.countryName ?? user.location.countryCode,
  ].filter(Boolean);
  if (parts.length > 0) return parts.join(", ");
  return user.location.customCityString?.trim() || null;
};

/** How the member arrived, after the inviter's name: " via group invite link “Spring”". */
export const inviteSource = (invitedBy: UserAdminInvitedByDto): string => {
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
      return ` via ${sentenceCase(invitedBy.referralSource).toLowerCase()}`;
    case undefined:
      return "";
    default:
      throw new Error(
        `unknown referral source: ${invitedBy.referralSource satisfies never}`,
      );
  }
};

export const reminderTime = (
  user: Pick<UserAdminDetailDto, "preferredReminderTime" | "timeZone">,
): string | null => {
  if (!user.preferredReminderTime) return null;
  return user.timeZone
    ? `${user.preferredReminderTime} ${user.timeZone}`
    : user.preferredReminderTime;
};

/** A failed write from a row or the header shows in the page's banner. */
export type MemberErrorReporting = {
  reportError: (message: string) => void;
  clearError: () => void;
};
