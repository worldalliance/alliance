import type {
  CommunityInviteStatus,
  OnetimeInviteStatus,
} from "@alliance/shared/client";

type InviteStatusDisplay = { label: string; textClass: string };

// Mobile's Tailwind build scans only `shared/styles` for class names, so these must live here.
const textClass = {
  pending: "text-amber-500",
  accepted: "text-green",
  rejected: "text-orange-600",
  cancelled: "text-zinc-500",
} as const;

export const onetimeInviteStatusDisplay = {
  request_pending: { label: "Request pending", textClass: textClass.pending },
  request_rejected: { label: "Rejected", textClass: textClass.rejected },
  link_used: { label: "Accepted", textClass: textClass.accepted },
  link_unused: { label: "Pending", textClass: textClass.pending },
} as const satisfies Record<OnetimeInviteStatus, InviteStatusDisplay>;

export const communityInviteStatusDisplay = {
  request_pending: { label: "Request pending", textClass: textClass.pending },
  request_rejected: {
    label: "Request rejected",
    textClass: textClass.rejected,
  },
  invitee_pending: { label: "Pending", textClass: textClass.pending },
  invitee_accepted: { label: "Accepted", textClass: textClass.accepted },
  invitee_rejected: { label: "Rejected", textClass: textClass.rejected },
  cancelled: { label: "Cancelled", textClass: textClass.cancelled },
} as const satisfies Record<CommunityInviteStatus, InviteStatusDisplay>;
