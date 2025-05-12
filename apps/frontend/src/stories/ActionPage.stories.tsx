import { StoryObj, Meta } from "@storybook/react";
import ActionPage from "../pages/app/ActionPage";

const meta = {
  title: "Alliance/ActionPage",
  component: ActionPage,
  tags: ["page"],
  parameters: {},
  args: {
    action: {
      id: 1,
      name: "Action 1",
      description: "Description 1",
      image: "https://via.placeholder.com/150",
    },
  },
} satisfies Meta<typeof ActionPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
