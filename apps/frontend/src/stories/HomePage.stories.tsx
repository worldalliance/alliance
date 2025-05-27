import { StoryObj, Meta } from "@storybook/react";
import HomePage from "../pages/app/HomePage";
import { HttpResponse } from "msw";
import { testTodoActions } from "./testData";
import { http } from "msw";

const meta = {
  title: "Alliance/HomePage",
  component: HomePage,
  tags: ["page"],
  parameters: {
    msw: {
      handlers: [
        http.get("/actions/withStatus", () => {
          return HttpResponse.json(testTodoActions);
        }),
      ],
    },
  },
  args: {},
} satisfies Meta<typeof HomePage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};
