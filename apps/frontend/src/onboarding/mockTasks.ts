import type { FormSchema } from "@alliance/common/forms/form-schema";
import type { ActionWithAwayStatus } from "@alliance/shared/lib/actionUtils";

/**
 * The task list as the new onboarding flow should leave it, for design review.
 * Edit these freely: they never touch the database, and `?mock=1` on /tasks is
 * what swaps them in for the member's real actions.
 */

const hoursAgo = (hours: number) =>
  new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

function mockTask(
  fields: Pick<
    ActionWithAwayStatus,
    "id" | "name" | "shortDescription" | "body" | "category" | "timeEstimate"
  > & { usersCompleted: number; usersJoined: number },
): ActionWithAwayStatus {
  return {
    ...fields,
    image: "",
    status: "member_action",
    type: "Activity",
    visibilityMode: "public",
    isContractSigningAction: false,
    isForumParticipationAction: false,
    onboarding: false,
    optional: false,
    publicOnly: false,
    preventCompletion: false,
    shouldCompleteAfterDeadline: false,
    archived: false,
    priority: 0,
    shouldParticipate: true,
    canParticipate: true,
    userRelation: "none",
    awayStatus: "not_away",
    createdAt: hoursAgo(72),
    updatedAt: hoursAgo(72),
    updates: [],
    followUpForms: [],
    reviewers: [],
    events: [
      {
        id: fields.id * 10,
        title: "Assigned",
        description: "",
        date: hoursAgo(48),
        newStatus: "member_action",
        suiteManaged: false,
      },
    ],
  };
}

function page(fields: FormSchema["pages"][number]["fields"]): FormSchema {
  return {
    description: "",
    pages: [{ id: "page-1", title: "Page 1", fields }],
    submit: { label: "Complete" },
    outputViews: [],
    aggregateViews: [],
  };
}

export const MOCK_TASK_FORMS: Record<number, FormSchema> = {
  9001: page([
    {
      id: "reminders-intro",
      type: "display",
      kind: "text",
      text: "We send one reminder per action and nothing else. Pick when it should land.",
    },
    {
      id: "reminders-day",
      type: "input",
      kind: "select",
      label: "Which day works best?",
      required: true,
      options: [
        { label: "Monday", value: "mon" },
        { label: "Wednesday", value: "wed" },
        { label: "Saturday", value: "sat" },
        { label: "Sunday", value: "sun" },
      ],
    },
    {
      id: "reminders-time",
      type: "input",
      kind: "time",
      label: "What time?",
      required: true,
    },
  ]),
  9002: page([
    {
      id: "intro-text",
      type: "display",
      kind: "text",
      text: "Your group is the handful of members who will notice whether you show up. A sentence or two is plenty.",
    },
    {
      id: "intro-body",
      type: "input",
      kind: "textarea",
      label: "Say hello",
      placeholder: "Where you are, what you do, why you joined.",
      required: true,
    },
  ]),
  9003: page([
    {
      id: "roadless-text",
      type: "display",
      kind: "text",
      text: "The Roadless Rule protects 58 million acres of national forest from logging roads. The comment period closes this week.",
    },
    {
      id: "roadless-script",
      type: "display",
      kind: "copytext",
      title: "Talking points",
      text: "Roadless areas supply drinking water to millions of people and cost far less to maintain than roaded forest. Repealing the rule shifts that cost onto taxpayers for timber that the market does not need.",
    },
    {
      id: "roadless-comment",
      type: "input",
      kind: "textarea",
      label: "Paste the comment you submitted",
      placeholder:
        "In your own words — it carries more weight than a form letter.",
      required: true,
    },
  ]),
};

export const MOCK_TASKS: ActionWithAwayStatus[] = [
  mockTask({
    id: 9001,
    name: "Set action reminders",
    shortDescription:
      "Pick when we should nudge you, so a week never goes by without you hearing from us.",
    body: "Tell us the day and time that suits you. We send one reminder per action, and nothing else.",
    category: "community",
    timeEstimate: 2,
    usersCompleted: 412,
    usersJoined: 480,
  }),
  mockTask({
    id: 9002,
    name: "Introduce yourself",
    shortDescription:
      "Say hello to your group. A sentence about who you are and why you joined is plenty.",
    body: "Your group is the handful of members who will notice whether you show up. Post a short introduction so they know who you are.",
    category: "community",
    timeEstimate: 5,
    usersCompleted: 388,
    usersJoined: 480,
  }),
  mockTask({
    id: 9003,
    name: "Submit a public comment on the repeal of the Roadless Rule in the United States",
    shortDescription:
      "The Roadless Rule protects 58 million acres of national forest. The comment period closes this week.",
    body: "We drafted talking points you can adapt. Comments in your own words carry more weight than a form letter, so change what you like before submitting.",
    category: "environment",
    timeEstimate: 8,
    usersCompleted: 1240,
    usersJoined: 1600,
  }),
];
