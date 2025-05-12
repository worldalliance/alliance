import { Meta, StoryObj } from "@storybook/react";
import IssueCard from "../components/IssueCard";

const meta = {
  title: "Alliance/IssueCard",
  component: IssueCard,
  tags: ["component"],
  parameters: {
    layout: "centered",
  },
  args: {
    name: "Problem Area",
    description: "This is an issue",
    href: "/issue",
  },
} satisfies Meta<typeof IssueCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
