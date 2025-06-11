import { Meta, StoryObj } from "@storybook/react";
import ActionCommitButton from "../components/ActionCommitButton";

const meta = {
  title: "Alliance/ActionCommitButton",
  component: ActionCommitButton,
  tags: ["component"],
  parameters: {
    layout: "centered",
  },
  args: {
    committed: false,
    isAuthenticated: true,
    onCommit: () => {},
  },
} satisfies Meta<typeof ActionCommitButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
