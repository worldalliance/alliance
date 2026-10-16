import { fireEvent, screen, waitFor } from "@testing-library/react";
import {
  button,
  enterName,
  enterSingleUseName,
  InviteType,
  memberGroup,
  serveInviteForm,
} from "./InviteForm.testing";

const { api, renderForm } = serveInviteForm();

it("creates a group for a user leading none, invites into it, then picks it for the next invite", async () => {
  api.myCommunities = [memberGroup];
  const { onInviteCreated, groupsLoaded } = renderForm();
  enterSingleUseName("Sam");
  await groupsLoaded();
  screen.getByText(
    "You are not leading a group yet—create one to be responsible for this member.",
  );

  fireEvent.click(button("Create group and invite"));

  await screen.findByText("Invite created and copied to clipboard!");
  expect(api.communityBodies).toHaveLength(1);
  expect(api.onetimeBodies).toEqual([{ invitee: "Sam", communityId: 11 }]);
  expect(onInviteCreated).toHaveBeenCalled();
  screen.getByText("Who are you inviting?");

  enterSingleUseName("Kim");
  await waitFor(() =>
    expect(button("Copy new invite link").hasAttribute("disabled")).toBe(false),
  );
  fireEvent.click(button("Copy new invite link"));
  await waitFor(() => expect(api.onetimeBodies).toHaveLength(2));
  expect(api.onetimeBodies[1]).toEqual({ invitee: "Kim", communityId: 11 });
  await screen.findByText("Who are you inviting?");
});

it("creates a group, then a multi-use link into it", async () => {
  api.myCommunities = [];
  const { onReusableInviteCreated, groupsLoaded } = renderForm();
  enterName(InviteType.Multi, "Book club");
  await groupsLoaded();

  fireEvent.click(button("Create group and invite"));

  await screen.findByText("Invite link created and copied to clipboard!");
  expect(api.communityBodies).toHaveLength(1);
  expect(api.reusableBodies).toEqual([{ label: "Book club", communityId: 11 }]);
  expect(onReusableInviteCreated).toHaveBeenCalled();
});

it("selects a created group even when the invite into it is refused", async () => {
  api.myCommunities = [];
  api.onetimeInviteStatus = 500;
  const { onInviteCreated, groupsLoaded } = renderForm();
  enterSingleUseName("Sam");
  await groupsLoaded();

  fireEvent.click(button("Create group and invite"));

  await screen.findByText(/^Failed to create invite: /);
  expect(onInviteCreated).not.toHaveBeenCalled();
  await waitFor(() =>
    expect(
      screen.getAllByRole("button", { name: "First's Group" }),
    ).toHaveLength(2),
  );
  screen.getByText("Which group should they join?");
});
