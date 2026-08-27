import cupPhoto from "../../../assets/redesign/action-bringyourowncupimplemented.webp";
import ewastePhoto from "../../../assets/redesign/action-ewaste.webp";
import donationPhoto from "../../../assets/redesign/action-helenkellerdonation.webp";
import potholePhoto from "../../../assets/redesign/action-potholefilled.webp";
import christina from "../../../assets/redesign/avatar-christina.webp";
import kanishk from "../../../assets/redesign/avatar-kanishk.webp";
import nihar from "../../../assets/redesign/avatar-nihar.webp";
import xuijin from "../../../assets/redesign/avatar-xuijin.webp";
import democracy from "../../../assets/redesign/priority-democracy.jpg";
import environment from "../../../assets/redesign/priority-environment.jpg";
import poverty from "../../../assets/redesign/priority-poverty.jpg";
import technology from "../../../assets/redesign/priority-technology.jpg";

/** Founder direction: the present-tense "assembling" framing from Landing 3. */
export const HERO_HEADLINE = "We’re assembling a group that can act as one.";
export const HERO_SUBHEAD =
  "Our expert-guided network of people reliably commits 15 minutes per week to improve the world.";
export const HERO_CTA = "Join Us";

export type Priority = {
  id: string;
  /** Line breaks are authored, so the four titles stay visually balanced. */
  title: string;
  description: string;
  image: string;
};

/** Facts condensed from `lib/alliancePriorities.tsx` on the current site. */
export const priorities: Priority[] = [
  {
    id: "extreme-poverty",
    title: "Extreme\nPoverty",
    description:
      "Over 800 million people live on less than $3 a day. At that income, malnutrition, preventable disease, and child mortality are widespread. Progress has slowed for the first time since the 1990s.",
    image: poverty,
  },
  {
    id: "environmental-destruction",
    title: "Environmental\nDestruction",
    description:
      "Land clearing, overharvesting, pollution, and invasive species are driving species extinction at tens to hundreds of times the natural rate of the past 10 million years.",
    image: environment,
  },
  {
    id: "decline-of-democratic-institutions",
    title: "Decline of\nDemocratic\nInstitutions",
    description:
      "More countries are losing democratic qualities than at any time since the 1940s. Global freedom has fallen for 19 straight years.",
    image: democracy,
  },
  {
    id: "dangerous-technological-development",
    title: "Dangerous\nTechnological\nDevelopment",
    description:
      "Biotechnology is lowering the barrier to engineering deadly pathogens, and AI systems undermine trusted information while accelerating biological and cyber threats.",
    image: technology,
  },
];

/** A completed action gets a tick; joining or signing up gets a plus. */
export enum NotificationIcon {
  Check = "check",
  Plus = "plus",
}

export type HeroNotification = {
  id: string;
  name: string;
  othersCount: number;
  action: string;
  icon: NotificationIcon;
  avatars: string[];
  /** Shown beside completed actions, from the photos in `design/`. */
  photo?: string;
};

export const heroNotifications: HeroNotification[] = [
  {
    id: "contract",
    name: "Nihar Doshi",
    othersCount: 11,
    action: "Signed the membership contract",
    icon: NotificationIcon.Plus,
    avatars: [nihar, christina, kanishk],
  },
  {
    id: "cup-proposal",
    name: "Christina Okafor",
    othersCount: 43,
    action: "Delivered the ‘Bring-your-own-cup’ proposal to 12 cafes",
    icon: NotificationIcon.Check,
    avatars: [christina, xuijin, nihar],
    photo: cupPhoto,
  },
  {
    id: "vitamin-a",
    name: "Kanishk Rao",
    othersCount: 62,
    action: "Funded vitamin A supplements through Helen Keller International",
    icon: NotificationIcon.Check,
    avatars: [kanishk, nihar, xuijin],
    photo: donationPhoto,
  },
  {
    id: "local-group",
    name: "Xuijin Li",
    othersCount: 26,
    action: "Joined the San Francisco local group",
    icon: NotificationIcon.Plus,
    avatars: [xuijin, christina, kanishk],
  },
  {
    id: "potholes",
    name: "Christina Okafor",
    othersCount: 78,
    action: "Reported 214 potholes for city repair",
    icon: NotificationIcon.Check,
    avatars: [christina, kanishk, nihar],
    photo: potholePhoto,
  },
  {
    id: "ewaste",
    name: "Nihar Doshi",
    othersCount: 34,
    action: "Diverted 1.2 tonnes of e-waste from landfill",
    icon: NotificationIcon.Check,
    avatars: [nihar, xuijin, christina],
    photo: ewastePhoto,
  },
];

export const WORK_HEADLINE = "How does it work?";

export const COMMIT_TITLE = "Members commit";
export const COMMIT_STATEMENT =
  "I commit to complete each task to the best of my ability";
export const COMMIT_PLACEHOLDER = "Type the statement here";
export const COMMIT_CTA = "Join The Alliance";

export const TASK_TITLE = "Everyone completes actions";
export const TASK_STEPS = [
  "Identify a coffee shop in your area",
  "Bring the owner our ‘Bring-your-own-cup’ proposal",
  "Input the shop's name and location below",
];
export const TASK_CTA = "Complete";

export const UPDATE_TITLE_LABEL = "We share the outcome & learn for next week";
export const UPDATE_AUTHOR = "Sidney Hough";
export const UPDATE_HEADLINE =
  "‘Bring-your-own-cup’ cafe coalition received media coverage";
export const UPDATE_BODY =
  "Thank you to everyone that participated! Recall that media coverage was not itself the desired outcome of this action. The desired outcome was the cafes' adoption of a sustainable policy, which happened in advance because the cafes could point to the coverage.";

export const MODEL_HEADLINE =
  "Our model produces consistent reliability towards our goals";
export const MODEL_PARTNER_LABEL = "Become a partner";

export const GROWTH_HEADLINE_FAR =
  "With more members we’ll get closer to our four priorities";

export type Milestone = { members: number; label: string };

export const nearMilestones: Milestone[] = [
  { members: 25, label: "City Hearing" },
  { members: 100, label: "Small Business Policy" },
  { members: 250, label: "Federal Docket" },
  { members: 500, label: "State Testimony" },
  { members: 1000, label: "National Coverage" },
];

export const farMilestones: Milestone[] = [
  { members: 2500, label: "Multi-City Ordinance" },
  { members: 5000, label: "Supply Chain Pledge" },
  { members: 10000, label: "Federal Rule Change" },
  { members: 25000, label: "Legislative Agenda" },
  { members: 50000, label: "Treaty Advocacy" },
];

/** Puts the fill partway through the third segment, as the mockup shows. */
export const currentMemberCount = 225;

export const HOURS_START_LABEL = "Action arrives";
export const HOURS_END_LABEL = "Deadline";
export const HOURS_LEGEND_TOTAL = "Hours in the week";
export const HOURS_LEGEND_SPENT = "Time spent completing actions";

export type Testimonial = {
  id: string;
  /** Split so the closing sentences can carry weight. */
  quoteLead: string;
  quoteEmphasis: string;
  name: string;
  role: string;
  avatar: string;
};

/**
 * The first is the quote from the Figma. The other two are real quotes from the
 * current site, carrying this mockup's placeholder names and avatars.
 */
export const testimonials: Testimonial[] = [
  {
    id: "sameer",
    quoteLead:
      "I am convinced that the Alliance offers the platform for maximizing the impact of my time and energy contribution to the world over time. I want to be part of it and grow with it. They take your commitment seriously and will hold your feet to the fire. But ",
    quoteEmphasis:
      "it's just a few minutes per week and I've found every project thus far to be self-enriching and meaningful.",
    name: "Sameer Vaidya",
    role: "Alliance Member",
    avatar: kanishk,
  },
  {
    id: "christina",
    quoteLead:
      "On the whole, the world is not going in the right direction. We need new ideas to change that, and the Alliance is just that. ",
    quoteEmphasis: "But it will work only if we all participate.",
    name: "Christina Okafor",
    role: "Alliance Member",
    avatar: christina,
  },
  {
    id: "nihar",
    quoteLead:
      "There is an inability to leverage collective will towards problems that almost everybody agrees exist. I think this is mostly the result of individuals not having clear actions that can affect the relevant issues. ",
    quoteEmphasis: "The Alliance is the natural solution.",
    name: "Nihar Doshi",
    role: "Alliance Member",
    avatar: nihar,
  },
];

export const PEOPLE_CTA = "Meet our people";

export const CTA_HEADLINE = "Join us";
export const CTA_BODY =
  "Every new member contributes to our model’s development and progress towards building a global force.";
export const CTA_BUTTON = "Request an invite";

export const FOOTER_TAGLINE =
  "A global group of people cooperating to improve the world.";
export const FOOTER_COPYRIGHT = "© 2026 Alliance Foundation";

export const NAV_LINKS = [
  { label: "People", href: "/people" },
  { label: "Guide", href: "/guide" },
  { label: "Progress", href: "/progress" },
];

export const NAV_PARTNER = "Partner with Us";
export const NAV_LOGIN = "Log In";

export type FooterLink = { label: string; href: string; external?: boolean };

/** `external` links get the arrow, matching the nav. */
export const FOOTER_COLUMNS: FooterLink[][] = [
  [
    { label: "Log In", href: "/login", external: true },
    { label: "Partner with Us", href: "/outreach-partner", external: true },
  ],
  [
    { label: "People", href: "/people" },
    { label: "Guide", href: "/guide" },
    { label: "Progress", href: "/progress" },
  ],
  [
    { label: "FAQ", href: "/faq" },
    { label: "Governance", href: "/governance" },
  ],
];

/** Sit on the copyright row, dot-separated. */
export const FOOTER_LEGAL_LINKS: FooterLink[] = [
  { label: "Privacy", href: "/privacypolicy" },
  { label: "Terms", href: "/terms" },
];

/** Flat list for the footer that lays links out in a single row. */
export const FOOTER_LINKS_FLAT = FOOTER_COLUMNS.flat();
