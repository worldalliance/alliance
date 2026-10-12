import { UserCheck, UserPlus } from "lucide-react";
import React from "react";

export type ProgramSection = "invited" | "active";

export const sectionConfig: Record<
  ProgramSection,
  {
    title: string;
    empty: string;
    addLabel: string;
    removeLabel: string;
    icon: React.ReactNode;
  }
> = {
  invited: {
    title: "Invited",
    empty: "No invited members yet.",
    addLabel: "Add invited member",
    removeLabel: "Remove invited",
    icon: <UserPlus size={18} />,
  },
  active: {
    title: "Active participants",
    empty: "No active participants yet.",
    addLabel: "Add participant",
    removeLabel: "Remove participant",
    icon: <UserCheck size={18} />,
  },
};
