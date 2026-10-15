import type { ActionStatus } from "@alliance/shared/client";

export const ACTION_STATUS_LABELS: Record<ActionStatus, string> = {
  draft: "Draft",
  planned: "Planned",
  office_action: "Office Action",
  member_action: "Member Action",
  resolution: "Resolution",
  completed: "Completed",
  failed: "Failed",
  abandoned: "Abandoned",
};

export const ACTION_STATUS_COLORS: Record<ActionStatus, string> = {
  draft: "bg-gray-100 text-gray-800",
  planned: "bg-blue-100 text-blue-800",
  office_action: "bg-orange-100 text-orange-800",
  member_action: "bg-purple-100 text-purple-800",
  resolution: "bg-indigo-100 text-indigo-800",
  completed: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  abandoned: "bg-gray-100 text-gray-600",
};
