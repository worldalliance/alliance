import { StoryObj, Meta } from "@storybook/react";
import ActionPage from "../pages/app/ActionPage";

import StoryRouter from "./StoryRouter";
import { http, HttpResponse } from "msw";
import { testActions, testForumPosts } from "./testData";

const meta = {
  title: "Alliance/ActionPage",
  component: ActionPage,
  tags: ["page"],
  parameters: {
    msw: {
      handlers: [
        http.get("/actions/1", () => {
          return HttpResponse.json(testActions[0]);
        }),
        http.get("/forum/posts/action/1", () => {
          return HttpResponse.json(testForumPosts);
        }),
      ],
    },
  },
  args: {},
} satisfies Meta<typeof ActionPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    return (
      <StoryRouter initialEntry="/action/1" path="/action/:id">
        <ActionPage />
      </StoryRouter>
    );
  },
};
