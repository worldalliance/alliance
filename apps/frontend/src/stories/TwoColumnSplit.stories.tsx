import { StoryObj, Meta } from "@storybook/react";
import TwoColumnSplit, {
  TwoColumnSplitProps,
} from "../components/system/TwoColumnSplit";

const meta = {
  title: "Alliance/TwoColumnSplit",
  component: TwoColumnSplit,
  tags: ["system"],
  parameters: {},
  args: {
    left: <div>Left</div>,
    right: <div>Right</div>,
    coloredRight: true,
  } satisfies TwoColumnSplitProps,
} satisfies Meta<typeof TwoColumnSplit>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
