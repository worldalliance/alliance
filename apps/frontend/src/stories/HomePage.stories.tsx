import { StoryObj, Meta } from "@storybook/react";
import HomePage from "../pages/app/HomePage";
import { HttpResponse } from "msw";
import { testNotJoinedActions, testTodoActions } from "./testData";
import { http } from "msw";
import NavbarHorizontal from "../components/NavbarHorizontal";

const meta = {
  title: "Alliance/HomePage",
  component: HomePage,
  tags: ["page"],
  parameters: {
    msw: {
      handlers: [
        http.get("/actions/withStatus", () => {
          return HttpResponse.json([
            ...testTodoActions,
            ...testNotJoinedActions,
          ]);
        }),
      ],
    },
  },
  args: {},
} satisfies Meta<typeof HomePage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    return (
      <>
        <NavbarHorizontal />
        <HomePage />
      </>
    );
  },
};
