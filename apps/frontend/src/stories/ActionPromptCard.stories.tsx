import { Meta, StoryObj } from "@storybook/react";
import ActionPromptCard from "../components/ActionPromptCard";

const meta = {
  title: "Alliance/ActionPromptCard",
  component: ActionPromptCard,
  tags: ["component"],
  parameters: {
    layout: "centered",
  },
  args: {
    title: "Boycott Acme Inc.",
    description:
      "Acme. corp has been found to lorem over 160,00 ipsums every single year, causing untold devastation in the placeholder text industry.",
    category: "Climate Change",
    id: "1",
  },
} satisfies Meta<typeof ActionPromptCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
