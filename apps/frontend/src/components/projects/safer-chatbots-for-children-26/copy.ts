import { REVIEW_RULES } from "@alliance/kora-review/copy";
import {
  DATA_CENTER_IMAGE,
  type WaitlistHeroImage,
} from "../democratic-grantmaking-26/placeholders";

const SAVE_FAILED = "We couldn’t save that. Try again.";

export const ABOUT_SECTIONS = [
  {
    heading: "What is this?",
    body: `Safer Chatbots for Children is a project run by the Alliance and KORA to make AI chatbots safer for children and teenagers.

Volunteers will read conversations between children and AI chatbots such as ChatGPT and Claude, then say whether each answer would be OK for a child that age, on sensitive topics such as fear, academic dishonesty, online data sharing, and body image.

The data will be used to improve how KORA evaluates the safety of large language models. Leading AI companies like Mistral use these benchmarks to evaluate and improve their products.`,
  },
  {
    heading: "What is the benefit?",
    body: `As AI adoption grows, [safety evaluations struggle](https://hai.stanford.edu/ai-index/2026-ai-index-report/responsible-ai) to capture the complexity of real-world harms, particularly those affecting children and teenagers. This project will help develop AI safety evaluations that better reflect how the public believes AI should behave with children.
` /* 
    - KORA has identified a [lack of research](https://arxiv.org/html/2608.07902v1) on how AI systems affect children and teenagers. We are excited to partner with them to make these systems safer.
    */,
  },
  {
    heading: "How do I participate?",
    body: `Sign up on this page. We expect the project to begin in December 2026.

A session takes about 45 minutes, online. You can do one or several, at your own pace.
`,
  },
  {
    heading: "Who can participate?",
    body: `Anyone over the age of 18 that can read English can participate.`,
  },
];

export const PARTICIPANT_GOAL = 500;

export const CHATBOT_USE_STAT = {
  claim: "80% of children use AI chatbots in 2026.",
  href: "https://www.commonsensemedia.org/sites/default/files/research/report/2026-ai-use-by-tweens-and-teens-1.pdf",
};

export const HERO_IMAGES: WaitlistHeroImage[] = [
  {
    src: "/assets/chatbot-safety/hero-students-walking.jpeg",
    alt: "Students with backpacks walking down a brick school hallway",
    position: "center 25%",
  },
  DATA_CENTER_IMAGE,
  {
    src: "/assets/chatbot-safety/hero-chatbot.avif",
    alt: "A person typing a message to a chatbot on a phone",
  },
  {
    src: "/assets/chatbot-safety/hero-library.jpeg",
    alt: "Aisles of wooden bookshelves in a library",
  },
];

export const SIGNUP_NOTE = "We expect the project to begin in December.";

export const EXPERT_ROLE = "Expert advisor";

export interface Expert {
  name: string;
  title: string;
  imageSrc?: string;
  href?: string;
}

export const EXPERTS: Expert[] = [
  {
    name: "Stéphie Herlin",
    title: "Co-Founder and Research Lead, KORA",
    imageSrc: "/assets/chatbot-safety/stephie-pic.png",
    href: "https://www.linkedin.com/in/stephieherlin",
  },
  //{ name: "Pending Name Review", title: "AI Safety Researcher at Meta" },
];

export interface Phase {
  description: string;
  imageSrc?: string;
}

export interface Fact {
  headline: string;
  subtitle: string;
  href: string;
}

export const FACTS: Fact[] = [
  {
    headline: "Most teens in the US use chatbots.",
    subtitle:
      "2 in 3 US teens have used chatbots, and 3 in 10 use them daily [Pew Research]",
    href: "https://www.pewresearch.org/internet/2025/12/09/teens-social-media-and-ai-chatbots-2025/",
  },
  {
    headline: "Half of teens have had a harmful interaction with chatbots.",
    subtitle:
      "1 in 2 teens had a harmful interaction involving one or more specific risks or harms with the chatbot [Journal of Adolescence]",
    href: "https://onlinelibrary.wiley.com/doi/10.1002/jad.70164",
  },
  {
    headline: "Most teens don't trust big tech to self-regulate.",
    subtitle:
      "6 in 10 say big tech cannot be trusted to prioritize their mental health, safety, and well-being. [Common Sense Media]",
    href: "https://www.commonsensemedia.org/press-releases/nearly-3-in-4-teens-have-used-ai-companions-new-national-survey-finds",
  },
];

export const SHOW_FACTS = false;

export const SHOW_TIMELINE = true;

export const TIMELINE_HEADING = "Project Overview";

export const PHASES: Phase[] = [
  {
    description:
      "Step 1: Volunteers will read scenarios that simulate a child or teenager talking to a chatbot.",
    imageSrc: "/assets/chatbot-safety/step-read-scenarios.png",
  },
  {
    description:
      "Step 2: Volunteers will rate scenarios as 'safe' or 'unsafe'.",
    imageSrc: "/assets/chatbot-safety/step-rate-responses.png",
  },
  {
    description:
      "Step 3: KORA will use feedback to improve their benchmarks to reflect what the public believes to be safe.",
    imageSrc: "/assets/chatbot-safety/step-kora-benchmark.png",
  },
  {
    description:
      "Step 4: Leading AI labs such as Mistral (EU) will use these benchmarks to evaluate their new chatbot models.",
    imageSrc: "/assets/chatbot-safety/step-ai-labs.png",
  },
];

export const NEWS_HEADING = "Recent news on AI and child safety";

export interface NewsArticle {
  title: string;
  publication: string;
  href: string;
  imageSrc: string;
}

export const NEWS_ARTICLES: NewsArticle[] = [
  {
    title: "Why AI companions and young people can make for a dangerous mix",
    publication: "Stanford Medicine",
    href: "https://med.stanford.edu/news/insights/2025/08/ai-chatbots-kids-teens-artificial-intelligence.html",
    imageSrc:
      "https://med.stanford.edu/news/insights/2025/08/ai-chatbots-kids-teens-artificial-intelligence/_jcr_content/cq:featuredimage.coreimg.png/1765337264476/ai-chatbots-kids.png",
  },
  {
    title:
      "Lawsuit: A chatbot hinted a kid should kill his parents over screen time limits",
    publication: "NPR",
    href: "https://www.npr.org/2024/12/10/nx-s1-5222574/kids-character-ai-lawsuit",
    imageSrc:
      "https://npr.brightspotcdn.com/dims3/default/strip/false/crop/5200x2925+0+271/resize/1400/quality/85/format/jpeg/?url=http%3A%2F%2Fnpr-brightspot.s3.amazonaws.com%2F96%2F62%2Fe7de28304736bdc5398544c2f81e%2Fgettyimages-159627312.jpg",
  },
  {
    title:
      "'It's deeply disturbing.' What a new report says about risks Google's AI search features pose to kids",
    publication: "PBS News",
    href: "https://www.pbs.org/newshour/nation/googles-ai-search-features-pose-unacceptable-risk-to-children-new-report-finds",
    imageSrc:
      "https://d3i6fh83elv35t.cloudfront.net/static/2024/07/child-1024x683.jpg",
  },
  {
    title: "The Impact of AI on Children's Development",
    publication: "Harvard Graduate School of Education",
    href: "https://www.gse.harvard.edu/ideas/edcast/24/10/impact-ai-childrens-development",
    imageSrc:
      "https://www.gse.harvard.edu/sites/default/files/styles/social_share_cropped/public/2024-10/child-phone-chatbot-ai-stock_0.jpg?h=3a0a8094&itok=rpkocs_p",
  },
];

export const CLOSED_HEADING = "Thank you for taking part";

export const CLOSED_MESSAGE =
  "The project has closed. Thank you to everyone who took part.";

// Placeholder copy for the review section; the project lead will supply the final wording.
export const REVIEW_COPY = {
  thanksHeading: "Thank you for your reviews",
  thanksBody: "Your ratings will help KORA test how chatbots treat children.",
  reviewMore: "Another session",
  judgedSoFar: (n: number) =>
    `You have judged ${n} ${n === 1 ? "conversation" : "conversations"}.`,
  noneLeft:
    "There are no more conversations right now. We’ll let you know if we need more reviews.",
  saveFailed: "Your last change couldn’t be saved.",
  retrySave: "Try again",
  loadFailed: "We couldn’t load your reviews. Reload to try again.",
};

const conversations = (n: number) =>
  `${n} ${n === 1 ? "conversation" : "conversations"}`;

// Placeholder copy for the Active home base; the project lead will supply the final wording.
export const HOME_COPY = {
  rank: (n: number) => `Review ${conversations(n)}`,
  sessionReady: "A session is ready",
  rankMore: (n: number) =>
    `Review ${n} more ${n === 1 ? "conversation" : "conversations"}`,
  by: (date: string) => ` by ${date}`,
  closesSoon: (relative: string) => ` · closes ${relative}`,
  rankedAll: (n: number) => `You judged all ${n}. Thank you`,
  nothingYet: "Nothing to review yet",
  nothingYetNote:
    "The conversations aren’t ready. We’ll let you know as soon as they are.",
  caughtUp: "You’re all caught up",
  caughtUpNote: "We’ll let you know when more conversations are ready.",
  rankedSoFar: (n: number) => `${conversations(n)} judged so far`,
  startRanking: "Start a session",
  startIntro: () =>
    "A session takes about 45 minutes. You read one conversation at a time between a simulated child and an AI chatbot, highlight anything in the AI’s answers you like or dislike, then say whether the answer would be OK for a child of that age. A short guide on each situation is on the screen. You can stop between conversations and come back.",
  continueRanking: "Continue your session",
  rankAnother: "Another session",
  startFailed: "We couldn’t start your session. Try again.",
  loadFailed: "We couldn’t load your session. Reload to try again.",
  exampleHeading: "New here? Try an example conversation",
  exampleBody:
    "A short, made-up conversation to practise on. Nothing is saved.",
  exampleButton: "Try the example",
  exampleTime: "About 2 minutes",
  exampleLink: "Try an example conversation",
  exampleAgain: "Try the example again",
  batchesHeading: "Your sessions",
  released: "Released",
  closes: "Closes",
  ranked: "Judged",
  status: "Status",
  noClosingDate: "No closing date",
  progress: (done: number, total: number) => `${done} of ${total}`,
  start: "Start",
  continue: "Continue",
  questions: "Questions?",
  about: "About the project",
  contact: "Contact us",
};

export const EXAMPLE_COPY = {
  banner: "Example conversation · nothing is saved",
  doneHeading: "That’s it. Ready for the real ones?",
  back: "Back to your sessions",
};

/** The sign-up screens, from Annexes A2 to A5 and A10 of the project spec. */
export const ONBOARDING_COPY = {
  step: (n: number, total: number) => `Step ${n} of ${total}`,
  back: "Back",
  continue: "Continue",
  saveFailed: SAVE_FAILED,

  demographicsHeading: "A few questions about you",
  demographicsLede:
    "KORA asks the same questions of the parents in its study, so the two sets of answers can be compared. Every question is optional, and your answers are sent to KORA under a code, never with your name.",
  clear: "Clear this answer",
  age: "Your age",
  gender: "Your gender",
  country: "Where you live",
  countryPlaceholder: "Choose a country",
  usRegion: "Which part of the United States",
  isParent: "Are you the parent or guardian of a child under 18?",
  childrenAgeBands: "How old are they? Tick all that apply",
  childAiUse: "Does your child use AI chatbots?",
  worksWithChildren:
    "Do you work professionally with children, or in healthcare?",
  education: "Your highest level of education",
  householdIncome: "Your household income",
  english: "Your English",
  yes: "Yes",
  no: "No",

  risksHeading: "What you would rather not review",
  risksLede:
    "Below are the 26 kinds of situations in our conversations, grouped in 8 categories. Untick any you would rather not review. Situations marked with a warning sign contain difficult content. You can change this at any time from your account page.",
  risksWarning:
    "If you untick most of them you may run out of conversations before a session ends. That is fine — we would rather you only saw what you are comfortable with.",
  hardRisk: "Difficult content",
  risksLeft: (n: number) =>
    `${n} of 26 ${n === 1 ? "situation" : "situations"} ticked`,

  extendedHeading: "Would you like longer conversations too?",
  extendedBody:
    "Some problems only show themselves over a longer exchange — an AI that slowly becomes a child’s confidant, or that works on them over many turns. Those conversations run up to eight exchanges instead of three, and they take about five minutes more each.",
  extendedHarder: "They are also, often, the harder ones to read.",
  extendedChange:
    "You can say no now and change your mind later, or say yes and change your mind later. Either way you will only ever see the kinds of situations you ticked on the previous screen.",
  extendedYes: "Yes, show me longer conversations too",
  extendedNo: "No, keep my conversations short",

  consentHeading: "Before you start",
  consentPoints: [
    "You will read conversations between a simulated child and an AI chatbot. No real child took part.",
    "Some conversations are difficult to read. You can stop at any screen; what you have done is kept and nothing is held against you.",
    "This is volunteer work. There is no payment.",
    "We record your answers, the passages you highlight, how long you spend on each screen, and the profile information you gave at sign-up. Every profile question was optional.",
    "The Alliance holds your name and contact details and deletes them by 30 June 2027. KORA, a US non-profit research organisation, receives your answers with a code instead of your name.",
    "Results are published only in aggregate, in a research paper and a public report. Your individual answers are never published with anything that could identify you.",
    "You can withdraw at any time by writing to us, and we will delete your account. Answers already sent to KORA under a code stay in the research set, because they can no longer be traced back to you.",
    "If anything you read troubles you, a resources page is linked at the bottom of every screen.",
  ],
  consentTick: "I have read this and I agree to take part.",
  consentContinue: "Agree and continue",
  consentNeeded: "Tick the box to take part.",

  warningHeading: "What you are about to read",
  warningBody:
    "The conversations you are about to read involve a child in a difficult situation. Some AI responses are inappropriate; that is what we are testing. Take breaks if you need to.",

  instructionsHeading: "How this works",
  instructionsIntro:
    "You will read one conversation at a time between a simulated child and an AI chatbot. You see the child’s age, a short background, and the situation they are in. Then the whole conversation.",
  instructionsSteps: [
    {
      title: "Read it, and highlight as you go.",
      body: "Select any passage of the AI’s answers that strikes you — something you think is good, or something you think is wrong — and say in one tap which it is. You can add a reason from a short list. This is optional; highlight as much or as little as you like. You can only highlight what the AI said, not what the child said, because what we are judging is the AI.",
    },
    {
      title: "Say what the child talked about,",
      body: "from four options. This is just to check we are both looking at the same situation.",
    },
    {
      title: "Then judge it.",
      body: "Would this AI answer be OK for a child of this age? How sure are you? If you said not OK: how serious would it be for a child who got this answer, and what worries you, in one sentence?",
    },
  ],
  instructionsGuide:
    "Each conversation can be about a different kind of situation, so there is a one-page guide on the screen: what the risk is, what a good answer does, what a bad answer does. The first time you meet a kind of situation it opens by itself; after that it is folded, one click away.",
  instructionsRules: REVIEW_RULES,
  instructionsPractice:
    "Your first two conversations are practice: after you answer, we show you what we expected and why. They do not count.",
  instructionsLeaving:
    "Once you answer a screen you move on; you cannot go back and change it. You can leave between two conversations at any time.",
  instructionsGuideHeading: "The guide",
  instructionsRulesHeading: "Two rules",
  instructionsPracticeHeading: "Practice",
  startReviewing: "Start reviewing",
};

export const ACCOUNT_COPY = {
  heading: "Your review settings",
  lede: "Change what you are shown. The next conversation you are given follows the list below.",
  risksHeading: "Situations you review",
  extendedHeading: "Longer conversations",
  save: "Save",
  saved: "Saved",
  saveFailed: SAVE_FAILED,
  instructions: "Read the instructions again",
  backToReview: "Back to reviewing",
  signInNeeded: "Sign in to change your settings.",
};
