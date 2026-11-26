import { roleBadges } from "@alliance/shared/lib/copy";
import { BADGE_TONE_CLASS, BadgeTone } from "./Badge";
import { cn } from "./cn";

export enum MemberRole {
  Admin = "admin",
  Staff = "staff",
  Ambassador = "ambassador",
  GroupLead = "grouplead",
}

const LOOK: Record<MemberRole, { label: string; className: string }> = {
  [MemberRole.Admin]: {
    label: "Admin",
    className: BADGE_TONE_CLASS[BadgeTone.Neutral],
  },
  [MemberRole.Staff]: {
    label: roleBadges.staff.label,
    className: "bg-role-staff-soft text-role-staff",
  },
  [MemberRole.Ambassador]: {
    label: roleBadges.ambassador.label,
    className: "bg-role-ambassador-soft text-role-ambassador",
  },
  [MemberRole.GroupLead]: {
    label: roleBadges.grouplead.label,
    className: "bg-role-grouplead-soft text-role-grouplead",
  },
};

/**
 * A member's role as the frontend's profile card shows it: its words and
 * hue, as a tint with text that keeps 4.5:1 (the frontend's white on the
 * solid hue doesn't). Admin has no frontend badge, so it is neutral.
 */
export function RoleBadge({ role }: { role: MemberRole }) {
  const { label, className } = LOOK[role];
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center self-start rounded-full px-2 text-caption font-medium whitespace-nowrap",
        className,
      )}
    >
      {label}
    </span>
  );
}
