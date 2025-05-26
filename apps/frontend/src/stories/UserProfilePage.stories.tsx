import { StoryObj, Meta } from "@storybook/react";
import UserProfilePage from "../pages/app/UserProfilePage";

import StoryRouter from "./StoryRouter";
import { http, HttpResponse } from "msw";
import { ProfileDto } from "@alliance/shared/client";

const testUser: ProfileDto = {
  id: 1,
  name: "First Lastname",
  email: "first.lastname@example.com",
  admin: false,
  profilePicture: "https://via.placeholder.com/150",
  profileDescription:
    "This is a test description of a user thats a sort of medium length. It isn't too long, but it also isn't that short. It has a sort of just right amount of length.",
};

const meta = {
  title: "Alliance/UserProfilePage",
  component: UserProfilePage,
  tags: ["page"],
  parameters: {
    msw: {
      handlers: [
        http.get("/user/1", () => {
          return HttpResponse.json(testUser);
        }),
      ],
    },
  },
  args: {},
} satisfies Meta<typeof UserProfilePage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    return (
      <StoryRouter initialEntry="/user/1" path="/user/:id">
        <UserProfilePage />
      </StoryRouter>
    );
  },
};
