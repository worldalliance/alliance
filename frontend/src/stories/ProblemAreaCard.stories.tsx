import { Meta, StoryObj } from "@storybook/react";
import IssueCard from "../components/IssueCard";

const meta = {
  title: "Alliance/ProblemAreaCard",
  component: IssueCard,
  tags: ["component"],
  parameters: {
    layout: "centered",
  },
  args: {
    name: "Problem Area",
    description: "This is a problem area",
    href: "/problem-area",
  },
} satisfies Meta<typeof IssueCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
