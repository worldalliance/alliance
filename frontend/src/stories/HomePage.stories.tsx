import { StoryObj, Meta } from "@storybook/react";
import HomePage from "../pages/app/HomePage";

const meta = {
  title: "Alliance/HomePage",
  component: HomePage,
  tags: ["page"],
  parameters: {},
  args: {},
} satisfies Meta<typeof HomePage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};
