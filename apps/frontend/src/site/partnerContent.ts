export const PARTNER_TITLE = "Mobilize an online community that cares";

export const PARTNER_RELY_TITLE =
  "Our unique model allows partners to rely on us";

/** The vague promise most networks make, beside the one we can make. */
export const partnerReliance = [
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

/** The two halves of a partnership, stated plainly under the pledges. */
export const partnerTrade = [
  {
    title: "What we can do",
    body: "Run a focused action where members help with a clear, useful task.",
  },
  {
    title: "What we ask",
    body: "Help your audience or staff team learn about the Alliance and potentially join us as members.",
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

export const PARTNER_FORM_TITLE = "Sign up as a potential outreach partner";
export const PARTNER_FORM_BODY =
  "Tell us what you are working on, what kind of action would help you, and how you could help people discover the Alliance.";

export const OUTREACH_CHANNELS = [
  "Website",
  "Newsletter or mailing list",
  "Online meeting",
  "In-person event",
  "Social media",
  "Member community",
  "Other",
] as const;

export const PARTNER_CHANNELS_LABEL =
  "How could your organization help others learn about the Alliance?";
export const PARTNER_AUDIENCE_LABEL =
  "Membership, mailing list, or audience size";

export const pastPartners = [
  { name: "EarthDay", href: "https://www.earthday.org/" },
  { name: "apgard", href: "https://www.apgardai.com/" },
  { name: "NutritionFacts.org", href: "http://nutritionfacts.org" },
];
