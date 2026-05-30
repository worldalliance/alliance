import { ActionDto } from "@alliance/shared/client";
import AppMarkdownWrapper from "@alliance/sharedweb/ui/AppMarkdownWrapper";
import { Meta, StoryObj } from "@storybook/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Flag, Layers, Megaphone, Target } from "lucide-react";
import React from "react";
import { testActions } from "./testData";

const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

/** Actions tailored to exercise the preview: thumbnail, live deadline, completed state. */
const previewActions: ActionDto[] = [
  {
    ...testActions[0],
    id: 1,
    type: "Activity",
    status: "member_action",
    usersCompleted: 157,
    events: [
      {
        id: 91,
        title: "Deadline",
        description: "",
        date: inDays(3),
        newStatus: "resolution",
        suiteManaged: false,
      },
    ],
  },
  {
    ...testActions[1],
    id: 2,
    type: "Funding",
    status: "member_action",
    donationAmount: 1000,
    usersCompleted: 57,
    userRelation: "completed",
    events: [],
  },
];

/**
 * Seed the query cache so the hover preview renders the example actions
 * without a live backend. The key must match `ActionLink`'s queryKey.
 */
function makeSeededClient() {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  for (const action of previewActions) {
    client.setQueryData(["actionLinkPreview", action.id], action);
  }
  return client;
}

const withSeededQueryClient = (Story: React.ComponentType) => (
  <QueryClientProvider client={makeSeededClient()}>
    <div className="max-w-prose p-8 text-base text-zinc-900">
      <Story />
    </div>
  </QueryClientProvider>
);

const meta = {
  title: "Alliance/ActionLink",
  component: AppMarkdownWrapper,
  tags: ["component"],
  parameters: { layout: "centered" },
  decorators: [withSeededQueryClient],
} satisfies Meta<typeof AppMarkdownWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

/** An action reference inside a paragraph — hover the link to see the preview. */
export const Inline: Story = {
  args: {
    markdownContent:
      "We've made real progress this month. If you haven't yet, " +
      "[help save the Ecuador cloud forest](/actions/1) — it only takes a " +
      "few minutes. You can also [pressure Target on single-use plastics]" +
      "(/actions/2) and read more on [our website](https://worldalliance.org).",
  },
};

/** Several action references in a list, mixed with a normal link. */
export const InList: Story = {
  args: {
    markdownContent: [
      "This action builds on a few others:",
      "",
      "- [Save the Ecuador cloud forest](/actions/1)",
      "- [Make Target end single-use plastics](/actions/2)",
      "- [An external reference](https://example.org)",
    ].join("\n"),
  },
};

/** Side-by-side comparison of candidate marker glyphs (no hover needed). */
export const GlyphComparison: Story = {
  args: { markdownContent: "" },
  render: () => {
    const glyphs: [string, React.ComponentType<{ size?: number; style?: React.CSSProperties }>][] =
      [
        ["Flag", Flag],
        ["Target", Target],
        ["Megaphone", Megaphone],
        ["Layers (current nav icon)", Layers],
      ];
    return (
      <div className="flex flex-col gap-y-3">
        {glyphs.map(([name, Icon]) => (
          <p key={name}>
            Help us{" "}
            <span className="text-link">
              save the Ecuador cloud forest
              <Icon size={13} style={{ margin: "-3px 0 0 3px", display: "inline-block" }} />
            </span>{" "}
            <span className="text-zinc-400">— {name}</span>
          </p>
        ))}
      </div>
    );
  },
};
