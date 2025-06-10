import { Meta, StoryObj } from "@storybook/react";
import TaskCard from "../components/TaskCard";
import { testActions, testTodoActions } from "./testData";

const meta = {
  title: "Alliance/TaskCard",
  component: TaskCard,
  tags: ["component"],
  parameters: {
    layout: "centered",
  },
  args: {
    action: testActions[0],
  },
} satisfies Meta<typeof TaskCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    return (
      <div className="flex flex-col w-[700px] gap-y-4 text-gray-400">
        <p>ActionTaskType.Funding</p>
        <TaskCard action={testTodoActions[0]} onComplete={() => {}} />
        <p>ActionTaskType.Activity</p>
        <TaskCard action={testTodoActions[1]} onComplete={() => {}} />
        <p>ActionTaskType.Ongoing</p>
        <TaskCard action={testTodoActions[2]} onComplete={() => {}} />
      </div>
    );
  },
  args: {
    onComplete: () => {},
  },
};
