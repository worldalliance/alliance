import { StoryObj, Meta } from "@storybook/react";
import ActionPage from "../pages/app/ActionPage";

import StoryRouter from "./StoryRouter";

const meta = {
  title: "Alliance/ActionPage",
  component: ActionPage,
  tags: ["page"],
  parameters: {},
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
