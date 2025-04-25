import { StoryObj, Meta } from "@storybook/react";
import ActionPage from "../pages/ActionPage";

const meta = {
  title: "Alliance/ActionPage",
  component: ActionPage,
  tags: ["page"],
  parameters: {},
  args: {
    state: "uncommitted",
  },
} satisfies Meta<typeof ActionPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Uncommitted: Story = {
  args: {
    state: "uncommitted",
  },
};

export const Committed: Story = {
  args: {
    state: "committed",
  },
};
