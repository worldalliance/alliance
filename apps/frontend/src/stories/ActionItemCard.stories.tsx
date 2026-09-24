import { Meta, StoryObj } from "@storybook/react";
import ActionItemCard from "../components/ActionItemCard";
import { testActions, testActivities } from "./testData";

const meta = {
  title: "Alliance/ActionItemCard",
  component: ActionItemCard,
  tags: ["component"],
  parameters: {
    layout: "centered",
  },
  args: {
    action: testActions[0],
  },
} satisfies Meta<typeof ActionItemCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithFriends: Story = {
  args: {
    friendCommitmentActivities: Array.from({ length: 7 }, (_, i) => ({
      ...testActivities[0],
      id: i,
      user: { ...testActivities[0].user, id: i },
    })),
  },
};
