import { StoryObj, Meta } from "@storybook/react";
import ActionsListPage from "../pages/app/ActionsListPage";

const meta = {
  title: "Alliance/ActionsListPage",
  component: ActionsListPage,
  tags: ["page"],
  parameters: {},
  args: {
    actions: [
      {
        id: 1,
        name: "Action 1",
        description: "Description 1",
        image: "https://via.placeholder.com/150",
      },
    ],
  },
} satisfies Meta<typeof ActionsListPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
