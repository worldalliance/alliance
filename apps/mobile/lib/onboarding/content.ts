import type { ImageSourcePropType } from "react-native";

export const GATE_TITLE = "The Alliance";
export const GATE_SUBLINE = "Let’s build a cooperative future.";

export const COMMUNITY_HEADLINE =
  "We’re assembling a community that works together to combat global problems by committing 15 minutes every week.";

export const COMMITMENT_HEADLINE =
  "Members commit to weekly participation, which allows us to plan actions in advance.";

export const COMMITMENT_NOTE = "Tap to explore";

export const MINUTES_HEADLINE =
  "Every action takes about fifteen minutes of your week.";

export const MINUTES_NOTE =
  "You can complete the action at any time during the week.";

export const SCALE_HEADLINE =
  "The larger we are, the more impact we can have. Every new member is vital to us at this experimental stage.";

export const SCALE_NOTE =
  "Our work is advised by scientists, analysts, and other experts for rigor and effectiveness.";

export const PRIORITIES_NOTE =
  "We focus on urgent global crises that result from a lack of human coordination.";

export const HOURS_START_LABEL = "Action arrives";
export const HOURS_END_LABEL = "Deadline";
export const HOURS_LEGEND_TOTAL = "Hours in the week";
export const HOURS_LEGEND_SPENT = "Time spent completing actions";

export const AGREEMENT_HEADLINE = "Help us build a network of reliability.";

export const COMMITMENT_STATEMENT =
  "I commit to complete each task to the best of my ability.";

export const DETAILS_LINK = "View more details";

export const WELCOME_HEADLINE = "Welcome to The Alliance";
export const WELCOME_SUBLINE = "Let’s build a cooperative future.";

/** How long the join confirmation holds before the walkthrough takes over. */
export const WELCOME_SECONDS = 3;

export type Priority = {
  id: string;
  /** Line breaks are authored, so the four titles stay visually balanced. */
  title: string;
  description: string;
  image: ImageSourcePropType;
};

export const priorities: Priority[] = [
  {
    id: "extreme-poverty",
    title: "Extreme\nPoverty",
    description:
      "Over 800 million people live on less than $3 a day, commonly suffering from malnutrition and dying from preventable diseases.",
    image: require("../../assets/images/onboarding/priority-poverty.jpg"),
  },
  {
    id: "environmental-destruction",
    title: "Environmental\nDestruction",
    description:
      "The overuse of land for development and agriculture, overexploitation of natural resources, climate change, pollution, and invasive species are driving a mass extinction in nature.",
    image: require("../../assets/images/onboarding/priority-environment.jpg"),
  },
  {
    id: "democratic-decline",
    title: "Democratic\nDecline",
    description:
      "More countries are losing democratic qualities than at any time since the 1940s, and measures of global freedom have fallen for 19 straight years.",
    image: require("../../assets/images/onboarding/priority-democracy.jpg"),
  },
  {
    id: "dangerous-technology",
    title: "Dangerous\nTechnologies",
    description:
      "Biotechnology is lowering the barrier to engineering deadly pathogens, and experts warn that artificial intelligence poses a risk of human extinction.",
    image: require("../../assets/images/onboarding/priority-technology.jpg"),
  },
];

export type Milestone = { members: number; label: string };

/** The reachable half of the track, which is all onboarding shows. */
export const REACHED_MILESTONES: Milestone[] = [
  {
    members: 100,
    label: "Encourage a small business to adopt a sustainability policy",
  },
  { members: 300, label: "Conduct a large-scale citizen science project" },
];

export { nextMilestone as NEXT_MILESTONE } from "@alliance/shared/lib/copy";

/**
 * Faces inside the action mockups on the commitment screen. Bundled rather than
 * drawn from the live roll: a mockup that reshuffles on every load stops being
 * the same picture twice. The agreement's own faces are real members, via
 * `useSignupFaces`.
 */
export const MEMBER_FACES: ImageSourcePropType[] = [
  require("../../assets/images/onboarding/avatar-xuijin.webp"),
  require("../../assets/images/onboarding/avatar-christina.webp"),
  require("../../assets/images/onboarding/avatar-nihar.webp"),
  require("../../assets/images/onboarding/avatar-kanishk.webp"),
];

export const WELCOME_IMAGE = require("../../assets/images/onboarding/welcome-image2.png");

export const MEMBERS_PHOTO = require("../../assets/images/onboarding/members-photo.webp");
