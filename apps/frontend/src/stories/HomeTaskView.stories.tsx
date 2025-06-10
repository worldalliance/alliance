import { Meta, StoryObj } from "@storybook/react";
import { HomeTaskView } from "../components/HomeTaskView";
import { testActions } from "./testData";

const meta = {
  title: "Alliance/HomeTaskView",
  component: HomeTaskView,
  tags: ["component"],
  parameters: {
    layout: "centered",
  },
  args: {
    actions: [testActions[0], testActions[1]],
  },
} satisfies Meta<typeof HomeTaskView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    return (
      <div className="flex flex-col w-[700px]">
        <HomeTaskView actions={testActions} />
      </div>
    );
  },
};
