import { nextMilestone } from "@alliance/shared/lib/copy";
import type { Milestone } from "@alliance/shared/lib/milestones";
import { href } from "react-router";
import type { Picture } from "vite-imagetools";
import democracy from "../assets/redesign/priority-democracy.jpg?w=400;800&format=avif;webp;jpg&as=picture";
import environment from "../assets/redesign/priority-environment.jpg?w=400;800&format=avif;webp;jpg&as=picture";
import poverty from "../assets/redesign/priority-poverty.jpg?w=400;800&format=avif;webp;jpg&as=picture";
import technology from "../assets/redesign/priority-technology.jpg?w=400;800&format=avif;webp;jpg&as=picture";
import { WAITLIST_HREF } from "./links";

/** The tail is set unbreakable, so the headline never orphans "other". */
export const HERO_HEADLINE_PARTS = {
  lead: "We’re assembling people who can count",
  tail: "on each other",
};
export const HERO_SUBHEAD =
  "To combat global problems, we commit 15 minutes each week to projects that depend on everyone’s participation. We are in an experimental phase.";

export type UpcomingProject = {
  title: string;
  href: string;
  imageSrc: string;
  progress: { done: number; goal: number; unit: string };
};

export const UPCOMING_PROJECTS_LABEL = "Upcoming projects";

export const UPCOMING_PROJECTS: UpcomingProject[] = [
  {
    title: "Vote on where we donate $100,000",
    href: WAITLIST_HREF,
    imageSrc: "/assets/democratic-grantmaking-26/environment.jpg",
    progress: { done: 267, goal: 1000, unit: "members" },
  },
  {
    title: "Make AI chatbots safer for kids",
    href: href("/projects/safer-chatbots-for-children"),
    imageSrc: "/assets/chatbot-safety/hero-chatbot.avif",
    progress: { done: 238, goal: 500, unit: "participants" },
  },
];

export type Priority = {
  id: string;
  /** Line breaks are authored, so the four titles stay visually balanced. */
  title: string;
  description: string;
  image: Picture;
};

export const priorities: Priority[] = [
  {
    id: "extreme-poverty",
    title: "Extreme\npoverty",
    description:
      "Over 800 million people live on less than $3 a day, commonly suffering  from malnutrition and dying from preventable diseases.",
    image: poverty,
  },
  {
    id: "environmental-destruction",
    title: "Environmental\ndestruction",
    description:
      "The overuse of land, overexploitation of natural resources, climate change, pollution, and invasive species are driving a mass extinction in nature.",
    image: environment,
  },
  {
    id: "democratic-decline",
    title: "Democratic\ndecline",
    description:
      "More countries are losing democratic qualities than at any time since the 1940s, and measures of global freedom have fallen for 19 years.",
    image: democracy,
  },
  {
    id: "dangerous-technology",
    title: "Dangerous\ntechnologies",
    description:
      "Biotechnology lowers the barrier to engineering deadly pathogens, and experts warn artificial intelligence poses a risk of extinction.",
    image: technology,
  },
];

export const PRIORITIES_NOTE =
  "We focus on urgent global crises that result from a lack of human coordination.";

export const WORK_HEADLINE = "How does it work?";
export const WORK_SUBHEAD =
  "Members commit to weekly participation, which allows us to make precise plans in advance.";

export const COMMIT_TITLE = "Members make a commitment";
export const COMMIT_PLEDGE = "I will complete each 15-minute task on time";

export const TASK_TITLE = "Everyone contributes to weekly projects";
export const TASK_STEPS = [
  "Go on a walk and collect trash",
  "Record the brand of each item",
];
export const TASK_PROGRESS_DONE = 189;
export const TASK_PROGRESS_TOTAL = 233;
export const TASK_CTA = "Complete";

export const UPDATE_TITLE = "We learn and share the outcomes";
export const UPDATE_HEADLINE = "We collected data on 1,022 pieces of trash";
export const UPDATE_BODY =
  "Beverage bottles were the most common item collected (82), followed by cigarette butts and food wrappers. We're writing up a report...";

export const MODEL_HEADLINE = "We plan projects that we expect to succeed";
export const MODEL_PROJECTS_LABEL = "See previous projects";

/** The middle clause links out to the people page. */
export const GROWTH_HEADLINE_FAR_PARTS = {
  lead: "The larger we are, the more impact we can have. Our work is advised by ",
  link: "scientists, analysts, and other experts",
  tail: " for rigor and effectiveness.",
};

export const GROWTH_FOOTNOTE =
  "With millions of members, we could make enormous progress on global crises by strategically coordinating our time, money, and votes.";

export const HOURS_START_LABEL = "Action arrives";
export const HOURS_END_LABEL = "Deadline";
export const HOURS_LEGEND_TOTAL = "Hours in the week";
export const HOURS_LEGEND_SPENT = "Time spent completing actions";

export const nearMilestones: Milestone[] = [
  { members: 30, label: "Jointly pitch the media on an underreported topic" },
  {
    members: 100,
    label: "Encourage a small business to adopt a sustainability policy",
  },
  { members: 300, label: "Conduct a large-scale citizen science project" },
  {
    members: 1000,
    label: nextMilestone.action,
  },
];

export const farMilestones: Milestone[] = [
  {
    members: 3000,
    label: "Run an online deliberation to design policies with popular support",
  },
  { members: 10000, label: "Develop a crowd-sourced fact-checking program" },
  { members: 30000, label: "Fill city council meetings across a country" },
  {
    members: 100000,
    label:
      "Raise money to lift 50 villages out of poverty by reducing luxury consumption",
  },
];

/**
 * The member whose quote leads the home page, and the split that lets its
 * closing sentences carry weight. Name and picture come from their profile.
 */
export const HOME_TESTIMONIAL = {
  memberId: 96,
  role: "Alliance member",
  quoteLead:
    "I am convinced that the Alliance offers the platform for maximizing the impact of my time and energy contribution to the world over time. I want to be part of it and grow with it. They take your commitment seriously and will hold your feet to the fire. But ",
  quoteEmphasis:
    "it's just a few minutes per week and I've found every project thus far to be self-enriching and meaningful.",
};

export const CTA_BODY =
  "Each new member makes every new project more impactful";

export const FOOTER_TAGLINE =
  "A global group of people cooperating to improve the world.";
export const CONTACT_EMAIL = "contact@worldalliance.org";
