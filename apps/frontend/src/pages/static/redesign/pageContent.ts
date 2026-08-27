import christina from "../../../assets/redesign/avatar-christina.webp";
import kanishk from "../../../assets/redesign/avatar-kanishk.webp";
import nihar from "../../../assets/redesign/avatar-nihar.webp";
import xuijin from "../../../assets/redesign/avatar-xuijin.webp";

/**
 * Copy for the pages behind the nav. Facts, names, and quotes are taken from
 * the current site; the member directory reuses the mockups' placeholder
 * members, since the real one is loaded from the API.
 */

export const PEOPLE_TITLE = "People";
export const PEOPLE_LEDE =
  "A full-time office plans the actions. Members carry them out. Experts tell us where we are wrong.";

export const OFFICE_TITLE = "Office";
export const OFFICE_BODY =
  "Our staff team plans actions, creates infrastructure, and manages the Alliance.";
export const OFFICE_PHOTO_CAPTION = "The office in San Francisco";

export type OfficeMember = { name: string; role: string; href?: string };

export const officeMembers: OfficeMember[] = [
  { name: "Sidney Hough", role: "Co-founder", href: "https://sidney.com/" },
  { name: "Mark Xu", role: "Co-founder", href: "https://markxu.com/" },
  {
    name: "Casey Manning",
    role: "Office",
    href: "https://caseymanning.github.io/",
  },
  { name: "Charles Lien", role: "Office" },
];

export const EXPERTS_TITLE = "Expert group";
export const EXPERTS_BODY =
  "Experts occasionally lend time, knowledge, or resources to the Alliance.";
export const EXPERTS_NOTE =
  "This list only includes experts who have chosen to make their information public.";

export type Expert = { name: string; description: string };

/** The public list from the current `/people` page. */
export const experts: Expert[] = [
  {
    name: "Janos Pasztor",
    description: "Former UN Assistant Secretary-General for Climate Change",
  },
  {
    name: "Denis Hayes",
    description:
      "Founding coordinator of Earth Day, Chair and CEO of the Bullitt Foundation",
  },
  { name: "Tara Chklovski", description: "Founder, CEO, Technovation" },
  {
    name: "Brice Lalonde",
    description: "Former French Minister of the Environment",
  },
  { name: "Connie Guglielmo", description: "Former Editor-in-Chief, CNET" },
  { name: "Beth Barnes", description: "Founder and CEO of METR" },
  {
    name: "Durwood Zaelke",
    description:
      "President, Institute for Governance & Sustainable Development",
  },
  {
    name: "Dustin Palmer",
    description: "Executive Director, US Programs at GiveDirectly",
  },
  { name: "Tom Luben", description: "Former US EPA ORD Scientist" },
  {
    name: "Romina Picolotti",
    description:
      "President, Center for Human Rights and Environment; former Argentine Secretary of the Environment",
  },
  {
    name: "Gernot Wagner",
    description: "Climate economist, Columbia Business School",
  },
  {
    name: "Jennifer King",
    description: "Privacy & Data Policy Fellow, Stanford HAI",
  },
  { name: "Ben Kalina", description: "Filmmaker and professor" },
  { name: "Nathan Calvin", description: "General Counsel at Encode AI" },
  { name: "Kim Stanley Robinson", description: "Science fiction writer" },
  { name: "Oran Young", description: "Professor Emeritus, UC Santa Barbara" },
  {
    name: "Santiago Creuheras",
    description:
      "Harvard Ash Center Fellow; former Mexico Deputy Minister for the Environment and Sustainable Energy",
  },
  {
    name: "Travis Williams",
    description: "Professor of Chemistry, University of Southern California",
  },
  {
    name: "Matti Wilks",
    description: "Associate Professor in Psychology, University of Edinburgh",
  },
  { name: "Aditya Jain", description: "Instagram Trust and Safety" },
  {
    name: "Paul Gambill",
    description: "Climate entrepreneur; previously founder of Nori",
  },
];

export const MEMBERS_TITLE = "Members";
export const MEMBERS_NOTE =
  "This directory only includes members who have chosen to make their information public.";
/** Reads as "The Alliance has 225 members. Membership is …". */
export const MEMBERS_INVITE_ONLY = "Membership is currently by invitation only.";

export type DirectoryMember = {
  name: string;
  location: string;
  avatar: string;
  actionsCompleted: number;
};

export const directoryMembers: DirectoryMember[] = [
  {
    name: "Nihar Doshi",
    location: "Pune, India",
    avatar: nihar,
    actionsCompleted: 34,
  },
  {
    name: "Christina Okafor",
    location: "Seattle, USA",
    avatar: christina,
    actionsCompleted: 41,
  },
  {
    name: "Kanishk Rao",
    location: "Bengaluru, India",
    avatar: kanishk,
    actionsCompleted: 29,
  },
  {
    name: "Xuijin Li",
    location: "San Francisco, USA",
    avatar: xuijin,
    actionsCompleted: 37,
  },
  {
    name: "Sameer Vaidya",
    location: "London, UK",
    avatar: kanishk,
    actionsCompleted: 26,
  },
  {
    name: "Amara Ndiaye",
    location: "Dakar, Senegal",
    avatar: christina,
    actionsCompleted: 22,
  },
  {
    name: "Tomas Ferreira",
    location: "Lisbon, Portugal",
    avatar: nihar,
    actionsCompleted: 18,
  },
  {
    name: "Hana Sato",
    location: "Osaka, Japan",
    avatar: xuijin,
    actionsCompleted: 31,
  },
];

export const GUIDE_TITLE = "Guide to the Alliance";
export const GUIDE_LEDE =
  "What we are trying to do, how the office and members divide the work, and where we go next.";
/** Names the table of contents for screen readers; nothing draws it. */
export const GUIDE_TOC_LABEL = "Sections";

export const PROGRESS_TITLE = "Progress";
export const PROGRESS_LEDE =
  "Everything members have finished so far. Small actions, run to learn rather than to scale.";
/**
 * The two examples the progress page leaves out, by `actionId`.
 */
export const HIDDEN_IMPACT_ACTIONS = [132, 95];

/**
 * Members on the roll when each action ran, by `actionId`. Placeholder figures,
 * varied so the layout shows where a real number goes.
 */
export const membersAtAction: Record<number, number> = {
  139: 231,
  130: 224,
  84: 142,
  75: 204,
  56: 118,
  14: 96,
  91: 168,
  76: 187,
  86: 133,
  62: 159,
  64: 189,
  49: 104,
  32: 213,
  81: 88,
  50: 78,
  54: 211,
};

export const STATS_TITLE = "By the numbers";
export const STATS_BODY =
  "What particular actions produced, and how many of us there were at the time.";

export type ImpactStat = { value: string; label: string; members: number };

export const impactStats: ImpactStat[] = [
  {
    value: "11",
    label: "cafe locations adopted a bring-your-own-cup policy",
    members: 96,
  },
  {
    value: "57 kg",
    label: "of e-waste collected and taken to be recycled",
    members: 189,
  },
  {
    value: "$2,702",
    label: "raised for Helen Keller International",
    members: 142,
  },
  {
    value: "100+",
    label: "California cities sent public records requests",
    members: 168,
  },
  {
    value: "27",
    label: "researched comments submitted to regulators",
    members: 211,
  },
  { value: "20", label: "potholes reported and filled", members: 78 },
];

export const ACTIONS_TITLE = "Actions";
export const ACTIONS_BODY = "One-time actions that achieved tangible impact.";

export const FAQ_TITLE = "Frequently asked questions";
export const FAQ_LEDE =
  "If your question is not here, the guide covers the same ground at length.";

export const GOVERNANCE_TITLE = "Governance";
export const FOUNDATION_TITLE = "Foundation";
export const PRIVACY_TITLE = "Privacy policy";
export const TERMS_TITLE = "Terms & conditions";

export const PARTNER_TITLE = "Mobilize an online community that cares";
export const PARTNER_LEDE =
  "Alliance members each spend 15 minutes a week taking actions on our online platform. For organizations working on our priorities, we can design a focused task in which members help you.";

export const PARTNER_TRADE = [
  {
    title: "What we can do",
    body: "Run a focused action where members help with a clear, useful task.",
  },
  {
    title: "What we ask",
    body: "Help your audience or staff team learn about the Alliance and potentially join us as members.",
  },
];

export const PARTNER_PAST_LABEL = "We have previously worked with";

export type PastPartner = { name: string; href: string };

export const pastPartners: PastPartner[] = [
  { name: "EarthDay", href: "https://www.earthday.org/" },
  { name: "apgard", href: "https://www.apgardai.com/" },
  { name: "NutritionFacts.org", href: "http://nutritionfacts.org" },
];

export const PARTNER_RELY_TITLE =
  "Our unique model allows partners to rely on us";

export type ReliancePledge = { label: string; quote: string };

/** The vague promise most networks make, beside the one we can make. */
export const partnerReliance: ReliancePledge[] = [
  {
    label: "Network x",
    quote:
      "We will share your opportunity with our mailing list of 5000 people",
  },
  {
    label: "The Alliance",
    quote: "120 people will participate in your opportunity by next Monday",
  },
];

export const PARTNER_TASKS_TITLE = "What we have asked members to do";
export const PARTNER_TASKS_BODY =
  "Every partnership becomes a task with a deadline, written by the office and the same for every member.";

export type PartnerTask = {
  partner: string;
  href: string;
  title: string;
  steps: string[];
  done: number;
  total: number;
};

export const partnerTasks: PartnerTask[] = [
  {
    partner: "apgard",
    href: "https://www.apgardai.com/",
    title: "Review chatbot transcripts for child safety",
    steps: [
      "Read three transcripts between an assistant and a child",
      "Rate each against apgard's four-point rubric",
      "Quote the lines that decided your rating",
    ],
    done: 216,
    total: 233,
  },
  {
    partner: "EarthDay",
    href: "https://www.earthday.org/",
    title: "Take one fact to a room that has not heard it",
    steps: [
      "Pick a library, cafe, or noticeboard near you",
      "Ask whoever runs it for permission to post",
      "Photograph the notice where it went up",
    ],
    done: 189,
    total: 233,
  },
  {
    partner: "NutritionFacts.org",
    href: "http://nutritionfacts.org",
    title: "Give feedback on the redesigned research library",
    steps: [
      "Find one piece of research you would actually use",
      "Note where the navigation slowed you down",
      "Answer six questions on what you would change",
    ],
    done: 204,
    total: 233,
  },
];

export const PARTNER_OFFERS_TITLE = "How we can help";
export const PARTNER_OFFERS_BODY =
  "We can run any kind of action that helps your organization. These are a few common examples.";

export const partnerOffers = [
  {
    title: "Tell members about your cause",
    body: "Help people who already want to make a difference understand the issue you work on and why it matters.",
  },
  {
    title: "Get thoughtful feedback",
    body: "Invite members to review your website, actions, product, campaigns, messages, or other materials.",
  },
  {
    title: "Invite engagement",
    body: "Ask members to follow, comment, share, test, or attend something you are planning or doing.",
  },
  {
    title: "Help with data collection",
    body: "Members can fill out surveys, participate in studies, and collect other kinds of information.",
  },
];

export const PARTNER_FORM_TITLE = "Sign up as a potential outreach partner";
export const PARTNER_FORM_BODY =
  "Tell us what you are working on, what kind of action would help you, and how you could help people discover the Alliance.";

export const PARTNER_CHANNELS = [
  "Website",
  "Newsletter or mailing list",
  "Online meeting",
  "In-person event",
  "Social media",
  "Member community",
  "Other",
];

export const PARTNER_CHANNELS_LABEL =
  "How could your organization help others learn about the Alliance?";
export const PARTNER_AUDIENCE_LABEL = "Audience size";
export const PARTNER_SUBMIT = "Submit";
export const PARTNER_SUBMITTED =
  "Thanks. We received your response and will follow up soon.";

export const JOIN_TITLE = "Request to join";
export const JOIN_LEDE =
  "Membership is by invitation while we are still small. Tell us a little about yourself and we will follow up with a signup link if there is a fit.";

/** The three points beside the form, so the page is not a bare form. */
export const JOIN_EXPECTATIONS = [
  "15 minutes a week, in one block, with a 7-day window to finish it.",
  "Tasks arrive through our platform, already researched and scoped by the office.",
  "You can withdraw from any task you object to, and leave whenever you like.",
];

export const JOIN_NAME_LABEL = "Your name";
export const JOIN_EMAIL_LABEL = "Email";
export const JOIN_REASON_LABEL = "Why do you want to join the Alliance?";
export const JOIN_REASON_PLACEHOLDER =
  "A sentence or two is plenty. What drew you here, and what would you want to work on?";
export const JOIN_SUBMIT = "Request an invite";
export const JOIN_SUBMITTED_TITLE = "Request received";
export const JOIN_SUBMITTED_BODY =
  "Thanks. We read every request, and we will email you either way.";
export const JOIN_MODAL_LABEL = "Request to join the Alliance";
