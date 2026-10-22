import { Features } from "./features";

export enum InfoEntryId {
  Email = "email",
  Visit = "visit",
  WhatIsTheAlliance = "what-is-the-alliance",
  MemberDirectory = "member-directory",
  Roadmap = "roadmap",
  AboutGroups = "about-groups",
  AboutAmbassadors = "about-ambassadors",
  HowToDesignActions = "how-to-design-actions",
  ActionUpdates = "action-updates",
  GeneralUpdates = "general-updates",
  Priorities = "priorities",
  Governance = "governance",
  Terminology = "terminology",
}

export type InfoContact = {
  id: InfoEntryId;
  title: string;
  description: string;
  href: `mailto:${string}`;
};

type InfoResource = {
  id: InfoEntryId;
  title: string;
  description: string;
  path: `/${string}`;
  feature?: Features;
};

export const INFO_CONTACTS: readonly InfoContact[] = [
  {
    id: InfoEntryId.Email,
    title: "Email",
    description: "Email the office with questions, feedback, or ideas.",
    href: "mailto:contact@worldalliance.org",
  },
  {
    id: InfoEntryId.Visit,
    title: "Schedule a visit",
    description:
      "Schedule a visit to the Alliance's physical office in San Francisco, CA, USA.",
    href: "mailto:contact@worldalliance.org?subject=Request to visit the office&body=I would like to schedule a visit to the Alliance's physical office on [DATE] at [TIME].",
  },
];

const INFO_RESOURCES = [
  {
    id: InfoEntryId.WhatIsTheAlliance,
    title: "What is the Alliance?",
    description:
      "The Alliance is a global group of individuals cooperating to improve the world.",
    path: "/guide",
  },
  {
    id: InfoEntryId.MemberDirectory,
    title: "Member directory",
    description: "A list of all members of the Alliance.",
    path: "/members",
  },
  {
    id: InfoEntryId.Roadmap,
    title: "Roadmap",
    description:
      "The Alliance is in an experimental phase and building up to a public launch.",
    path: "/roadmap",
  },
  {
    id: InfoEntryId.AboutGroups,
    title: "About groups",
    description:
      "The Alliance is organized into groups that help members hold each other accountable.",
    path: "/groups-guide",
  },
  {
    id: InfoEntryId.AboutAmbassadors,
    title: "About ambassadors",
    description: "How ambassadors help introduce the Alliance to new members.",
    path: "/ambassadors",
  },
  {
    id: InfoEntryId.HowToDesignActions,
    title: "How to design actions",
    description: "A basic guide that the office uses to design actions.",
    path: "/action-design",
  },
  {
    id: InfoEntryId.ActionUpdates,
    title: "Action updates",
    description: "Progress updates on our actions.",
    path: "/action-updates",
  },
  {
    id: InfoEntryId.GeneralUpdates,
    title: "General updates",
    description: "Updates about the Alliance's progress as an organization.",
    path: "/general-updates",
    feature: Features.GeneralUpdatesLink,
  },
  {
    id: InfoEntryId.Priorities,
    title: "Priorities",
    description: "An overview of our current priorities.",
    path: "/priorities",
  },
  {
    id: InfoEntryId.Governance,
    title: "Governance",
    description: "Members participate in a regular oversight process.",
    path: "/internal-governance",
  },
  {
    id: InfoEntryId.Terminology,
    title: "Terminology",
    description: "Some terms used in the Alliance.",
    path: "/terminology",
  },
] as const satisfies readonly InfoResource[];

/** `path` is a union of literals so the web can check each one against its routes with `href`. */
export type InfoResourceEntry = InfoResource & {
  path: (typeof INFO_RESOURCES)[number]["path"];
};

export const visibleInfoResources = (
  isFeatureEnabled: (feature: Features) => boolean,
): InfoResourceEntry[] =>
  INFO_RESOURCES.filter(
    (resource: InfoResource) =>
      resource.feature === undefined || isFeatureEnabled(resource.feature),
  );
