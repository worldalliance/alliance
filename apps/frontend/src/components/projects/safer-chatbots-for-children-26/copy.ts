import {
  DATA_CENTER_IMAGE,
  type WaitlistHeroImage,
} from "../democratic-grantmaking-26/placeholders";

export const ABOUT_SECTIONS = [
  {
    heading: "What is this?",
    body: `Safer Chatbots for Children is a project run by the Alliance and KORA to make AI chatbots safer for children and teenagers.

Volunteers will review transcripts of children talking to AI chatbots such as ChatGPT and Claude, then rate how well the chatbots handled sensitive topics such as fear, academic dishonesty, online data sharing, and body image.

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
    body: `Sign up on this page. We expect the project to begin in Mid-November 2026.

Participants will spend about an hour reviewing chatbot transcripts online. You can participate at your own pace.
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

export const SIGNUP_NOTE = "The project will begin November 17th";

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
