import { cleanup, render, screen } from "@testing-library/react";
import FriendRequestButton from "./FriendRequestButton";

afterEach(cleanup);

it("disables Accept while an accept is pending", () => {
  render(
    <FriendRequestButton
      friendStatus={{ status: "pending", didReceiveRequest: true }}
      handleSendFriendRequest={() => {}}
      handleRemoveFriend={() => {}}
      handleAcceptFriendRequest={() => {}}
      accepting
    />,
  );
  expect(
    screen.getByRole("button", { name: "Accept" }).hasAttribute("disabled"),
  ).toBe(true);
});
