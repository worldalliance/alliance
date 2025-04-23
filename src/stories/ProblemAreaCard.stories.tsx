import { Meta, StoryObj } from "@storybook/react";
import ProblemAreaCard from "../components/ProblemAreaCard";

const meta = {
  title: "Alliance/ProblemAreaCard",
  component: ProblemAreaCard,
  tags: ["component"],
  parameters: {
    layout: "centered",
  },
  args: {
    name: "Problem Area",
    description: "This is a problem area",
    href: "/problem-area",
  },
} satisfies Meta<typeof ProblemAreaCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
