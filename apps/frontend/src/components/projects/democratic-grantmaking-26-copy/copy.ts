export const ABOUT_SECTIONS = [
  {
    heading: "What is this?",
    body: "This is a project that will launch when the Alliance reaches 1,000 members. Outside funders have put up $100,000 for a nonprofit, and Alliance members will help decide which nonprofit will receive the money. ",
  },
  {
    heading: "How do I participate?",
    body: "Join the waitlist on this page. We'll reach out soon with an invitation to the Alliance. Once the Alliance reaches 1,000 members, this project will begin.",
  },
  {
    heading: "How will this work?",
    body: `1,000 Alliance members and an expert panel will decide how to donate the $100,000. This will happen in a four-step process:

1. Alliance members nominate nonprofits.
2. Experts analyze how each nonprofit would use the $100,000.
3. Alliance members use expert analyses to vote on nonprofits.
4. Experts select the final recipient from members' top choices.`,
  },
  {
    heading: "Why are we doing this?",
    body: "We're learning how to effectively combine member values and expert analysis to donate money. This process could one day become a transparent giving service for large-scale donors. After the project, we'll work with [Jan Maly](https://janmaly.de/) of [WU Vienna](https://www.wu.ac.at/en/dpkm) to publish our findings.",
  },
];

export const SIGNUP_INFO = [
  "Reviews are expected to take 45-60 minutes. The review period lasts from November 17 to December 15th.",
  "You will get an email or text when the review period begins.",
  "Signup form is not active yet. Please come back in a few days.",
];

export interface Expert {
  name: string;
  role: string;
  imageSrc?: string;
}

export const EXPERTS: Expert[] = [
  { name: "Expert name", role: "Title" },
  { name: "Expert name", role: "Title" },
];

export interface Phase {
  label: string;
  description: string;
  imageSrc?: string;
}

export const TIMELINE_HEADING = "How the project works";

export const PHASES: Phase[] = [
  { label: "Step 1", description: "Description" },
  { label: "Step 2", description: "Description" },
  { label: "Step 3", description: "Description" },
];

export const NEWS_HEADING = "In the News: Child Safety and AI";

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
