import type { OnetimeInviteStatus } from "@alliance/shared/client";

// Mobile's Tailwind build scans only `shared/styles` for class names, so these must live here.
export const onetimeInviteStatusDisplay = {
  request_pending: { label: "Request pending", textClass: "text-amber-500" },
  request_rejected: { label: "Rejected", textClass: "text-orange-600" },
  link_used: { label: "Accepted", textClass: "text-green" },
  link_unused: { label: "Pending", textClass: "text-amber-500" },
} as const satisfies Record<
  OnetimeInviteStatus,
  { label: string; textClass: string }
>;
