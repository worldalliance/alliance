export const ABOUT_SECTIONS = [
  {
    heading: "What is this?",
    body: `- Safer Chatbots for Children is a global project, done online by volunteers over the course of 1 month. Volunteers will read short scenarios of children turning to AI assistants and determine if the scenario shows safe behavior or not.
- Volunteers will review English transcripts of children messaging AI chatbots such as ChatGPT, Claude, and Mistral, then submit feedback on how well the chatbots handled sensitive topics such as fear, academic dishonesty, online data sharing, and body image.`,
  },
  {
    heading: "How do I participate?",
    body: `- This project is run by the Alliance and KORA that is accepting signups from the general public from any country.
- Join the waitlist on this page. We expect the project to begin in Mid-November 2026 and conclude by Mid-December 2026. 
- Volunteers are encouraged to join the Alliance to continue volunteering on similar tasks after this project concludes.
`,
  },
  {
    heading: "Why are we doing this?",
    body: "At the Alliance, we’re assembling people who can count on each other to combat global problems that depend on everyone’s participation. With this project, we are testing the model of “citizen oversight”, where the general public gets a chance to weigh in on disruptive, potentially dangerous technologies such as AI and help shape the direction of these technologies in a healthy, democratic way.",
  },
  {
    heading: "How will this work?",
    body: `1,000 Alliance members and an expert panel will decide how to donate the $100,000. This will happen in a four-step process:

1. Each participant will: Read short scenarios of children interacting with an AI chatbot, then rate each scenario as “safe”, “unsafe”, or “undetermined”

2. Kora, an AI safety nonprofit, will take the aggregated feedback on the scenarios to improve their safety tests (known in the industry as “benchmarks”) to match what is considered safe by the general public.

3. Leading AI companies like Mistral will use these benchmarks to evaluate their models and improve future chatbot releases.`,
  },
];

export const WAITLIST_GOAL = 500;

export const SIGNUP_BUTTON = "Join the waitlist for this project";

export const SIGNUP_NOTE = "The project will begin November 17th";

export interface Expert {
  name: string;
  role: string;
  imageSrc?: string;
}

export const EXPERTS: Expert[] = [
  { name: "Stéphie Herlin", role: "Head of Product and Research at KORA" },
  { name: "Pending Name Review", role: "AI Safety Researcher at Meta" },
];

export interface Phase {
  label: string;
  description: string;
  imageSrc?: string;
}

export const SHOW_TIMELINE = false;

export const TIMELINE_HEADING = "How the project works";

export const PHASES: Phase[] = [
  {
    label: "Step 1",
    description:
      "Volunteers read scenarios of children interacting with a chatbot.",
  },
  {
    label: "Step 2",
    description:
      "Volunteers rate the chatbot's responses as 'safe' or 'unsafe'",
  },
  {
    label: "Step 3",
    description:
      "KORA takes the volunteer feedback to improve their safety tests, or benchmarks, to reflect what the public believes to be safe.",
  },
  {
    label: "Step 4",
    description:
      "Leading AI labs, such as Mistral (EU), use these benchmarks to evaluate their new chatbot models.",
  },
];

export const NEWS_HEADING = "Recent news on the dangers of AI and Child Safety";

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
