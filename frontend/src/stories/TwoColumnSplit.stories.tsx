import { StoryObj, Meta } from "@storybook/react";
import TwoColumnSplit from "../components/system/TwoColumnSplit";

const meta = {
  title: "Alliance/TwoColumnSplit",
  component: TwoColumnSplit,
  tags: ["system"],
  parameters: {},
  args: {
    left: <div>Left</div>,
    right: <div>Right</div>,
  },
} satisfies Meta<typeof TwoColumnSplit>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
