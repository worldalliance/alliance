import { Meta, StoryObj } from "@storybook/react";
import ActionItemCard, { ActionCardAction } from "../components/ActionItemCard";

const meta = {
  title: "Alliance/ActionItemCard",
  component: ActionItemCard,
  tags: [],
  parameters: {
    layout: "centered",
  },
  args: {
    title: "Boycott Acme Inc.",
    description:
      "Acme. corp has been found to lorem over 160,00 ipsums every single year, causing untold devastation in the placeholder text industry.",
    category: "Climate Change",
    actions: [ActionCardAction.Complete, ActionCardAction.Discuss],
  },
} satisfies Meta<typeof ActionItemCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
