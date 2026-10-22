import type { ImageSourcePropType } from "react-native";
import { MEMBER_FACES } from "./content";

export enum TimelineEntryKind {
  Event = "event",
  Update = "update",
}

export type TimelineEntry =
  | { kind: TimelineEntryKind.Event; title: string; time: string }
  | {
      kind: TimelineEntryKind.Update;
      title: string;
      time: string;
      body: string;
    };

export type ActionExample = {
  id: string;
  title: string;
  description: string;
  timeline: TimelineEntry[];
  /** Sits under whichever timeline entry is at this index, as on the real page. */
  barAtIndex: number;
  completed: number;
  expected: number;
  minutes: number;
  faces: ImageSourcePropType[];
  /** The task write-up, which runs past the card and feathers out at its foot. */
  body: { heading?: string; text: string }[];
};

/** The action carrying an update leads, since it is the one that shows a result. */
export const ACTION_EXAMPLES: ActionExample[] = [
  {
    id: "data-breach",
    title:
      "Check if your personal information was exposed in major data breaches",
    description:
      "Members use an online tool to find whether their personal information turned up in a known breach, and how to secure it.",
    timeline: [
      {
        kind: TimelineEntryKind.Update,
        title: "Members found 1,412 exposures across 143 accounts",
        time: "6 days ago",
        body: "We passed the patterns to a journalist at Consumer Reports, and sent members’ notes on the tool itself back to Mozilla.",
      },
      {
        kind: TimelineEntryKind.Event,
        title: "Members taking action",
        time: "23 days ago",
      },
    ],
    barAtIndex: 1,
    completed: 143,
    expected: 177,
    minutes: 15,
    faces: MEMBER_FACES,
    body: [
      {
        text: "In this action you’ll use a free online tool called Mozilla Monitor to determine whether your personal information has been leaked in a data breach and, if so, take steps to protect the compromised accounts.",
      },
      {
        heading: "Background",
        text: "A data breach occurs when personal information, such as passwords, financial information, or health records, is leaked online. Usually, breaches result from cyberattacks or data mismanagement.",
      },
    ],
  },
  {
    id: "roadless-rule",
    title:
      "Submit a public comment on the repeal of the Roadless Rule in the United States",
    description:
      "The rule protects 58 million acres of national forest from logging roads. Members comment in their own words before the period closes.",
    timeline: [
      {
        kind: TimelineEntryKind.Event,
        title: "Members taking action",
        time: "2 days ago",
      },
      {
        kind: TimelineEntryKind.Event,
        title: "Office taking action",
        time: "9 days ago",
      },
    ],
    barAtIndex: 0,
    completed: 133,
    expected: 150,
    minutes: 15,
    faces: MEMBER_FACES,
    body: [
      {
        text: "The Forest Service has opened a comment period on repealing the 2001 Roadless Rule. Comments in your own words carry more weight than a form letter, so we have drafted talking points for you to adapt rather than copy.",
      },
      {
        heading: "Talking points",
        text: "Roadless areas supply drinking water to millions of people and cost far less to maintain than roaded forest. Repealing the rule shifts that cost onto taxpayers.",
      },
    ],
  },
  {
    id: "trash-data",
    title: "Collect trash data for a citizen science project",
    description:
      "Members log what they find on one short walk, so researchers get a picture of local waste no single survey could reach.",
    timeline: [
      {
        kind: TimelineEntryKind.Event,
        title: "Results published",
        time: "5 days ago",
      },
      {
        kind: TimelineEntryKind.Event,
        title: "Members taking action",
        time: "27 days ago",
      },
    ],
    barAtIndex: 1,
    completed: 152,
    expected: 163,
    minutes: 15,
    faces: MEMBER_FACES,
    body: [
      {
        text: "Take one short walk you would have taken anyway and log every piece of litter you pass in the Marine Debris Tracker app. Fifteen minutes is enough for a usable transect.",
      },
      {
        heading: "Background",
        text: "Litter surveys are expensive to run at scale, so most of the world has never been surveyed once. Volunteer transects are what fill the gaps.",
      },
    ],
  },
];
