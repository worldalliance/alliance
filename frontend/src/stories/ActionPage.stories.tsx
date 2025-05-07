import { StoryObj, Meta } from "@storybook/react";
import ActionPage from "../pages/app/ActionPage";

const meta = {
  title: "Alliance/ActionPage",
  component: ActionPage,
  tags: ["page"],
  parameters: {},
  args: {},
} satisfies Meta<typeof ActionPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
