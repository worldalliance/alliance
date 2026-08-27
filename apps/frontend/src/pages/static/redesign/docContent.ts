/**
 * The long-form pages, as markdown. Copy is taken from the current site:
 * `GuidePage`, `FoundationPage`, `GovernancePage`, `FAQPage`, `TermsPage`, and
 * `PrivacyPolicyPage`.
 *
 * Links to other mockup pages are written as `redesign:<slug>` so `DocProse`
 * can rewrite them with the version the reader is currently on.
 */

export enum GuideSectionKind {
  Introduction = "introduction",
  Structure = "structure",
  Actions = "actions",
  Priorities = "priorities",
  Roadmap = "roadmap",
  Resources = "resources",
}

export type GuideSectionCopy = {
  /** Shown in the table of contents. */
  label: string;
  markdown: string;
  /** Prose that follows the section's graphic, where it has one. */
  markdownAfter?: string;
};

export const GUIDE_SECTIONS: Record<GuideSectionKind, GuideSectionCopy> = {
  [GuideSectionKind.Introduction]: {
    label: "Introduction",
    markdown: `
The Alliance aims to facilitate **large-scale coordination** over the Internet. We are focused on four **global crises**: extreme poverty, environmental destruction, democratic decline, and dangerous technological development.

**Reliability** is key to our strategy. Every week, committed members participate in collective actions that advance our shared goals. Since we can count on members, we can plan each action with precision and predict whether it will succeed.

We are in an experimental, invite-only stage. Eventually, we hope to unite millions of people behind an **expert-guided, democratically approved plan** that strategically mobilizes our collective economic, political, and social resources.
`,
  },
  [GuideSectionKind.Structure]: {
    label: "Structure",
    markdown: `
The Alliance is composed of:

1. **A full-time office** that designs tasks to advance our priorities.
2. **Members** who commit to complete tasks assigned to them.

We built an online platform (web and mobile apps) that members use to complete tasks.
`,
    markdownAfter: `
We depend on members reliably completing the tasks they are assigned. Since we know exactly how many people will participate in an action, we can plan precise and effective actions. For example, we can:

- Build a base of common knowledge over time.
- Plan experiments with statistical significance.
- Make lifestyle changes only when there are enough members to have a meaningful total impact.
- Negotiate agreements with third parties, such as corporations, backed by credible financial incentives (such as a bulk purchase or promise of boycott).

New members sign a **membership contract** that sets a clear expectation of reliability. Once they sign a contract, we start to assign them tasks. If a member does not complete the tasks they are assigned, we automatically suspend their contract and no longer assign them tasks. They can re-sign the contract at any time.
`,
  },
  [GuideSectionKind.Actions]: {
    label: "Actions",
    markdown: `
Planning actions is a creative, open-ended process that searches for levers of change which members can pull.

When ideating for and developing an action, we weigh many considerations. For instance:

- How does the action relate to the priorities of the Alliance?
- Will the action produce a tangible impact on the world?
- Will the action make effective use of members' time?
- Will the action have any compounding effects – for instance, by providing an educational opportunity or growing the Alliance's network?

Examples of actions we have taken:
`,
  },
  [GuideSectionKind.Priorities]: {
    label: "Priorities",
    markdown: `
Our efforts are focused on four global crises: extreme poverty, environmental destruction, the decline of democratic institutions, and dangerous technological development.

By restricting our focus to problems that are widely recognized as urgent, we believe we can build a **broad coalition with clear, shared goals**.

These crises represent egregious violations of our foundational [moral principle](redesign:foundation): that we should not treat others in ways that we do not want to be treated. They cause, or have the potential to cause, enormous harm to billions of people.

In addition, these crises are amenable to coordinated action by individuals, because they are the complex result of decisions made by billions of people over time. If we can strategically channel trillions of dollars, billions of hours of work, and millions of voices, we can make rapid and enormous progress.
`,
  },
  [GuideSectionKind.Roadmap]: {
    label: "Roadmap",
    markdown: `
Right now, we are running small-scale actions with the primary goal of learning, not direct impact. We are focused on building internal processes and structures that we can trust to scale smoothly, including the way we develop and evaluate actions. We expect this phase to last for at least another 6 months.

Once we are confident in our processes and structures, we will launch publicly. After this point, we will shift our focus to growth and impact.

As the Alliance grows, we plan to bring together experts from diverse fields to make increasingly impactful, long-term plans. Our online platform will enable direct communication between these experts and millions of members to enact rapid, large-scale change.

It is difficult to know exactly which actions we will take as we grow. However, a few broad categories of actions include:
`,
  },
  [GuideSectionKind.Resources]: {
    label: "Resources",
    markdown: "",
  },
};

export const GUIDE_SECTION_ORDER: GuideSectionKind[] = [
  GuideSectionKind.Introduction,
  GuideSectionKind.Structure,
  GuideSectionKind.Actions,
  GuideSectionKind.Priorities,
  GuideSectionKind.Roadmap,
  GuideSectionKind.Resources,
];

export const GUIDE_CONTRACT_CAPTION = "Our current membership contract";

/** The four categories of action the roadmap points at, as a table. */
export type ActionCategory = { name: string; examples: string[] };

export const ACTION_CATEGORIES: ActionCategory[] = [
  {
    name: "Economic shifts",
    examples: [
      "We could enforce an ethical standard on an industry by asking members to only purchase from companies that meet it.",
      "We could coordinate individual waste reductions to meet global waste reduction targets.",
      "We could create healthier social media apps and all switch to them at once.",
    ],
  },
  {
    name: "Pooled funding",
    examples: [
      "We could pay large teams to undertake impactful work that could otherwise only be conducted by volunteers.",
      "We could fund entrepreneurial and educational programs in low-income countries to help build sustainable economies.",
      "We could incubate non-profit, democratic media companies.",
    ],
  },
  {
    name: "Social pressure",
    examples: [
      "We could direct public attention to an AI company and demand a specific safety policy.",
      "We could run a membership-wide education campaign to create global support for an enforceable biodiversity treaty.",
    ],
  },
  {
    name: "Direct action",
    examples: [
      "We could design and participate in the world's largest citizen science projects.",
      "We could create and participate in massive ecosystem restoration programs.",
    ],
  },
];

/**
 * The contract text itself comes from `@alliance/shared/lib/contract`, so the
 * guide and the governance page quote the real one.
 */
export const MEMBER_CONTRACT_TITLE = "Membership contract";

export const FOUNDATION_INTRO =
  "The following principle, aims, and priorities were developed and approved by 25 founding members of the Alliance.";

export const FOUNDATION_MARKDOWN = `
The Alliance is founded on a moral principle shared by nearly all cultures: we should not treat others in ways that we do not want to be treated.

Our modern, interconnected world is shaped by decisions made by billions of people. If we do not want others to disregard how their decisions impact us, we cannot disregard how our decisions impact them.

The Alliance holds itself and others accountable to this principle. At times, we will seek to change external institutions and individuals; at other times, we will change ourselves.

Given this principle, the initial aim of the Alliance is to create a world in which:

1. Every person has the resources and freedom to achieve happiness and fulfillment, as most people do not want others to deprive them of such opportunity;
2. Every person lives free of political, economic, and environmental insecurity, as most people do not want others to impose such conditions upon them;
3. Decisions of great importance for humanity are made with substantive democratic input, as most people do not want others to exclude them from choices which determine their future.

Therefore, the initial priorities of the Alliance are to address the following global crises, which represent great differences between our world and the world we seek to create: extreme poverty, environmental destruction, the decline of democratic institutions, and dangerous technological development.
`;

export const GOVERNANCE_INTRO =
  "The following governance procedures were developed and approved by 25 founding members of the Alliance.";

export const GOVERNANCE_MARKDOWN_BEFORE = `
## Membership

Members of the Alliance are individuals that have signed and abide by the following membership contract.
`;

export const GOVERNANCE_MARKDOWN_AFTER = `
This membership contract may be revised with signed members' consent. Additional membership contracts can be offered at the office's discretion.

## Strategic office

The office of the Alliance is the set of members responsible for ensuring the Alliance will fulfill its purpose given that members abide by their contracts.

In particular, the office is responsible for:

1. The development of and maintenance of a plan for the Alliance.
2. The decomposition of this plan into tasks.
3. The assignment and delivery of these tasks to members. As per the terms of the current membership contract, the office assigns each 15-minute block of tasks a 7-day window that does not overlap with the 7-day window of any other block.

In designing actions, the office aims to satisfy both:

1. The collective interests of members, as can be reasonably determined through internal democratic processes.
2. The collective interests of humanity, as can be reasonably determined using available data about global preferences.

## Oversight

These procedures are in effect until they are modified by a governance review process that requires the participation of all members. The office will schedule this review process at its discretion.

The Alliance meets its approval threshold when more than 3/4 of members indicate that they want the Alliance to continue to operate as it currently does.

To ensure the Alliance meets its approval threshold, the office will run a periodic oversight process. During an oversight process, the office will:

1. Conduct a membership-wide survey to evaluate if the Alliance meets its approval threshold.
2. If it does not, then the office will stop planning and running all actions until it changes how it operates.

The office will run an oversight process if either:

1. 6 months have passed since the last oversight process.
2. More than 1/4 of Alliance members request an oversight process.
`;

export type FaqItem = { id: string; question: string; answer: string };

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: "what-is-the-alliance",
    question: "What is the Alliance?",
    answer: `
The Alliance is a group of people working together to improve the world. Members spend a fraction of their time – currently 15 minutes a week – completing tasks on our online platform. These tasks are designed by a full-time strategic office to advance our priorities.

Our long-term goal is to unite humanity behind a democratic, expert-developed plan to end global crises. Right now, we are running experiments to test our organizational structures and processes.

We define "the Alliance" as the body of our members, not as any legal entity.
`,
  },
  {
    id: "how-do-i-join",
    question: "How do I join the Alliance?",
    answer: `
Membership is currently by invitation only. You can [request to join](redesign:join), and we will follow up with a signup link if there is a fit.
`,
  },
  {
    id: "how-is-the-alliance-structured",
    question: "How is the Alliance structured?",
    answer: `
The Alliance is composed of a body of members and a full-time strategic office.

1. The office is responsible for developing plans, and corresponding tasks, that effectively advance Alliance priorities.
2. Members are responsible for reliably completing tasks they are assigned on our online platform.
`,
  },
  {
    id: "what-are-the-priorities",
    question: "What are the priorities of the Alliance?",
    answer: `
In no particular order, we are focused on:

1. Extreme poverty
2. Environmental destruction
3. The decline of democratic institutions
4. Dangerous technological development

Our [foundation](redesign:foundation) explains how we derived them.
`,
  },
  {
    id: "how-is-the-alliance-governed",
    question: "How is the Alliance governed?",
    answer: `
We conduct a membership-wide oversight process that occurs on a regular basis. In the process, the Alliance office asks members what they think about the direction of the Alliance and whether or not they have any major concerns. The office collects and responds to feedback until we reach an approval threshold of 75%.

This procedure achieves two goals:

1. Members determine the high-level goals and methods of the Alliance.
2. The office retains the freedom to plan any action that advances approved goals with approved methods. It is not required to do what is most popular, nor do actions need unanimous support, so it can operate efficiently and effectively.

In addition to formal governance, the office incorporates member input by other means. For instance, the office hosts discussions, asks members for action proposals, solicits open-ended feedback, and so on.

Our [governance](redesign:governance) page sets out the procedures in full.
`,
  },
  {
    id: "what-is-expected-of-members",
    question: "What is expected of members?",
    answer: `
Members are expected to complete all tasks they are assigned on time. Members are not required to contribute to the Alliance financially.

We define members of the Alliance as individuals that have signed and abide by our membership contract.
`,
  },
  {
    id: "how-are-actions-designed-and-selected",
    question: "How are actions designed and selected?",
    answer: `
Action design is a creative, open-ended process that searches for levers of change that members can pull. The office draws inspiration from many places, including life experiences, subject matter experts, and member suggestions.

The office selects actions according to several criteria, including the quality of the experience they provide to members, the impact they achieve, and how they help the Alliance learn and build capacity.
`,
  },
  {
    id: "examples-of-actions",
    question: "What are some examples of actions?",
    answer: `
Right now, we are taking small-scale actions focused on learning, not direct impact. Our [progress](redesign:progress) page lists what we have done so far.
`,
  },
  {
    id: "why-are-tasks-not-optional",
    question: "Why are tasks not optional?",
    answer: `
Reliability is the foundation of the Alliance. Since the office knows exactly who and how many members will complete tasks, it can design concrete and effective action plans.

For example:

1. The office was able to motivate a group of cafes to adopt a sustainable policy before members took action because it could promise that members would help them attain media coverage later.
2. The office was able to design a statistically meaningful experiment because it knew how many members would participate.

Strategically, the Alliance operates like a sports team, orchestra, or company—not like a loose crowd. A crowd can be large and energetic, but it is unpredictable: people drift in and out, and no one knows exactly who will act when needed. By contrast, a sports team, orchestra, or company can set specific goals and execute precise strategies because every person will show up and do their part.

In the long run, the willingness of members to take actions that are inconvenient or do not personally benefit them will allow people with many different interests from around the world to help each other. Given the urgency of global crises, we prioritize effective action over perfect consensus.
`,
  },
  {
    id: "cannot-complete-a-task",
    question: "What if I do not, or cannot, complete a task?",
    answer: `
If you have already spent 15 minutes completing tasks in a given week, you can withdraw from your remaining tasks without affecting your membership status.

If you have a moral objection to a task, you can withdraw from that task without affecting your membership status.

Otherwise, a member who misses all assigned non-optional actions for 3 weeks in a row will have their contract suspended and will be unable to participate in Alliance governance.

Former members can rejoin the Alliance by re-signing the contract.
`,
  },
  {
    id: "outside-the-united-states",
    question: "What if I do not live in the United States?",
    answer: `
Alliance membership is open to anyone.

However, some actions require members to live in the United States. If an action is restricted to US members, we provide non-US members with a modified action, or we do not assign them that action.

As the Alliance grows, actions will have greater global coverage.
`,
  },
  {
    id: "who-runs-the-alliance",
    question: "Who runs the Alliance?",
    answer: `
The Alliance is run by Sidney Hough and Mark Xu. The full list of Alliance staff is on our [people](redesign:people) page.
`,
  },
  {
    id: "how-is-the-alliance-funded",
    question: "How is the Alliance funded?",
    answer: `
Initial funding for the Alliance was provided by [Elizabeth Barnes](https://barnes.page/). Funds are managed by the Alliance Foundation, a 501(c)(3) nonprofit organization.
`,
  },
];

export const PRIVACY_UPDATED = "Last updated 25 August 2025";

export const PRIVACY_MARKDOWN = `
Alliance Foundation ("Alliance," "we," "our," or "us") operates the Alliance Platform (the "Platform"). This privacy policy explains how our organization uses the personal data we collect from you when you use our website and services.

## What data do we collect?

The Alliance collects the following data:

- Personal identification information (name, email address, phone number)
- Account information (username, password, account preferences)
- Activity data related to your use of the Platform (actions joined, events created, preferences set)
- Payment information (processed securely through Stripe, never stored directly by us)
- Technical information (IP address, browser type, device information, approximate location)

## How do we collect your data?

You directly provide Alliance with most of the data we collect. We collect data and process data when you:

- Register online for an account on the Platform.
- Fill out your profile information.
- Opt in to receive SMS or email notifications.
- Voluntarily complete surveys or make posts.
- Contact us for support.
- Use or view our website via your browser's cookies.

## How will we use your data?

Alliance collects your data so that we can:

- Provide you access to and maintain your account.
- Notify you about activities, events, and updates you have opted in to receive.
- Process your payments.
- Improve our services, analytics, and website functionality.
- Enforce our Terms of Service and comply with applicable laws.

We do not sell or rent your personal data to third parties. Mobile information will not be shared with third parties for marketing or promotional purposes.

## How do we use cookies?

Alliance uses cookies to keep you signed in to the Platform, to remember your preferences, and to understand how you use the Platform. Our website uses functionality cookies, which recognise you on our site and remember preferences, and analytics cookies, which collect information on how users interact with the Platform.

## How to manage cookies

You can set your browser not to accept cookies, and you can remove cookies from your browser at any time. However, some website features may not function as a result.

## Privacy policies of other websites

The Alliance Platform may contain links to other websites. This privacy policy applies only to our Platform. If you click on a link to another website, you should read their privacy policy.

## Changes to our privacy policy

Alliance keeps its privacy policy under regular review and places any updates on this web page.

## How to contact us

If you have any questions about Alliance's privacy policy, the data we hold on you, or you would like to exercise one of your data protection rights, please contact us at [support@worldalliance.org](mailto:support@worldalliance.org).
`;

export const TERMS_UPDATED = "Last updated 25 August 2025";

export const TERMS_MARKDOWN = `
These Terms & Conditions ("Terms") govern the use of email and SMS/text message notifications ("Messaging Services") offered by **Alliance Foundation** ("Alliance," "we," "our," or "us") through the **Alliance Platform** (the "Platform"). By opting in to receive notifications, you agree to these Terms and our [privacy policy](redesign:privacy).

## 1. Eligibility and consent

- You must be a registered user of the Alliance Platform to receive notifications.
- By opting in through your account settings, you consent to receive communications from us, including but not limited to service updates, reminders, confirmations, and notifications related to your activity on the Platform.
- Opting in is entirely voluntary. You will not receive SMS or email notifications unless you expressly choose to do so.

## 2. Message frequency

The number and type of messages you receive will vary based on your activity on the Platform, your notification preferences, and the categories of alerts you choose to enable. Typical communications include account activity updates; notifications related to actions, events, or commitments you have joined; and service announcements, feature updates, and important legal or policy changes.

## 3. Opt-out and account controls

- You may opt out of SMS or email notifications at any time through your account settings.
- For SMS/text messages, you may also reply **"STOP"** to any message you receive from us to unsubscribe immediately from that notification channel.
- For email communications, you may use the "Unsubscribe" link included in the footer of each message, or adjust your preferences in your account settings.
- Please allow a reasonable processing time (up to 72 hours) for opt-out requests to take effect.

## 4. Customer support and contact

For questions, concerns, or assistance regarding Messaging Services, contact us at [support@worldalliance.org](mailto:support@worldalliance.org).

## 5. Messaging costs and carrier liability

- Standard message and data rates may apply for SMS/text messages, depending on your mobile carrier and plan.
- We are not responsible for any charges incurred from your mobile service provider as a result of receiving our messages.
- Message delivery is subject to your mobile carrier's network availability and performance. We are not liable for delayed or undelivered messages.

## 6. Privacy

- Personal information collected for Messaging Services will be handled in accordance with our [privacy policy](redesign:privacy).
- We will never sell, rent, or disclose your mobile phone number or email address to unaffiliated third parties for their marketing purposes without your explicit consent.

## 7. Prohibited uses

- Messaging Services are intended solely for communications between Alliance Foundation and you, the account holder.
- You may not use, misuse, or attempt to interfere with Messaging Services in a way that could damage or disrupt the Platform or its users.

## 8. Termination of Messaging Services

- We reserve the right to suspend or terminate Messaging Services at any time, with or without notice.
- If your account on the Platform is deactivated, closed, or terminated, you will no longer receive Messaging Services.

## 9. Modifications to Terms

- We may revise these Terms from time to time. Changes will be posted on this page with an updated effective date.
- Continued use of Messaging Services after such modifications constitutes your acceptance of the updated Terms.

## 10. Limitation of liability

- Messaging Services are provided on an "as is" and "as available" basis.
- Alliance Foundation disclaims liability for any damages, losses, or claims arising from or related to the receipt (or failure to receive) SMS or email messages.
- To the maximum extent permitted by law, Alliance Foundation and its affiliates are not responsible for indirect, incidental, or consequential damages arising from Messaging Services.

## 11. Acceptance of Terms

By opting in to receive SMS or email notifications from the Alliance Platform, you acknowledge that you have read, understood, and agreed to these Terms.
`;
