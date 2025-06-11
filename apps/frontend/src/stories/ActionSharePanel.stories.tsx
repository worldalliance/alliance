import { Meta, StoryObj } from "@storybook/react";
import ActionSharePanel from "../components/ActionSharePanel";
import { testActions } from "./testData";

const meta = {
  title: "Alliance/ActionSharePanel",
  component: ActionSharePanel,
  tags: ["component"],
  parameters: {
    layout: "centered",
  },
  args: {
    action: testActions[0],
  },
} satisfies Meta<typeof ActionSharePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
