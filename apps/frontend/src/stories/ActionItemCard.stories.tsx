import { Meta, StoryObj } from "@storybook/react";
import ActionItemCard from "../components/ActionItemCard";

const meta = {
  title: "Alliance/ActionItemCard",
  component: ActionItemCard,
  tags: ["component"],
  parameters: {
    layout: "centered",
  },
  args: {
    id: 1,
    name: "Boycott Acme Inc.",
    description:
      "Acme. corp has been found to lorem over 160,00 ipsums every single year, causing untold devastation in the placeholder text industry.",
    category: "Climate Change",
  },
} satisfies Meta<typeof ActionItemCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
