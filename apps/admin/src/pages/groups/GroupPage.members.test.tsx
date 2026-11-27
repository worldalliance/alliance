import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { answerLeaveGuard } from "../../lib/testing/leaveGuard";
import {
  addAda,
  api,
  deleteNorth,
  leaderRemovals,
  members,
  pressAndConfirm,
  renderPage,
  serveGroupPageApi,
} from "./groupPageTesting";

serveGroupPageApi();

it("drops a removed member and moves focus to the row beside it", async () => {
  renderPage();

  await pressAndConfirm("Remove from group: Sam", "Remove from group");

  await waitFor(() =>
    expect(members().queryByRole("link", { name: "Sam" })).toBeNull(),
  );
  await waitFor(() =>
    expect(document.activeElement?.getAttribute("aria-label")).toBe(
      "Remove leader: Lee",
    ),
  );
});

it("keeps a member whose removal is not confirmed", async () => {
  renderPage();
  fireEvent.click(
    await screen.findByRole("button", { name: "Remove from group: Sam" }),
  );

  fireEvent.click(
    within(await screen.findByRole("dialog")).getByRole("button", {
      name: "Cancel",
    }),
  );

  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(members().getByRole("link", { name: "Sam" })).toBeTruthy();
  expect(api.memberInfoRequests).toBe(1);
});

it("says why a removal was refused", async () => {
  api.removeStatus = 400;
  renderPage();

  await pressAndConfirm("Remove from group: Sam", "Remove from group");

  expect(await screen.findByText("Sam leads this group")).toBeTruthy();
  expect(members().getByRole("link", { name: "Sam" })).toBeTruthy();
});

it("goes back to the groups once a group is deleted", async () => {
  renderPage();

  await deleteNorth();

  expect(await screen.findByText("Groups list")).toBeTruthy();
});

it("deletes a group with unsaved settings without asking to leave", async () => {
  const asked = answerLeaveGuard(false);
  try {
    renderPage({ tab: "settings" });
    fireEvent.change(await screen.findByLabelText("Name"), {
      target: { value: "Northern" },
    });

    await pressAndConfirm("Delete group", "Delete group");

    expect(await screen.findByText("Groups list")).toBeTruthy();
    expect(asked).not.toHaveBeenCalled();
  } finally {
    asked.mockRestore();
  }
});

it("never says a just-deleted group is missing", async () => {
  const LoadingGroups = () => {
    throw new Promise(() => {});
  };
  renderPage({ list: <LoadingGroups /> });

  await deleteNorth();
  await screen.findByText("Group deleted");

  expect(screen.queryByText("Group not found")).toBeNull();
});

it("drops a removed leader", async () => {
  renderPage();

  await pressAndConfirm("Remove leader: Lee", "Remove leader");

  await waitFor(() =>
    expect(members().queryByRole("link", { name: "Lee" })).toBeNull(),
  );
});

it("adds the picked member and closes the picker", async () => {
  await addAda({
    open: "Add member…",
    pick: "Member to add",
    add: "Add member",
  });

  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(members().getByRole("link", { name: "Ada" })).toBeTruthy();
});

it("promotes a member to leader", async () => {
  renderPage();

  await pressAndConfirm("Make leader: Sam", "Make leader");

  await waitFor(() => expect(leaderRemovals()).toHaveLength(2));
});

it("shows the action's fallback when a write never reaches the server", async () => {
  api.addLeaderDrops = true;
  renderPage();

  await pressAndConfirm("Make leader: Sam", "Make leader");

  expect(await screen.findByText("Couldn't make them a leader.")).toBeTruthy();
});

it("adds the picked leader and closes the picker", async () => {
  await addAda({
    open: "Add leader…",
    pick: "Leader to add",
    add: "Add leader",
  });

  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(leaderRemovals()).toHaveLength(2);
});

it("shows a failed add in its dialog alone", async () => {
  api.addLeaderDrops = true;
  await addAda({
    open: "Add leader…",
    pick: "Leader to add",
    add: "Add leader",
  });

  const refusal = await screen.findByText("Couldn't add the leader.");
  expect(screen.getByRole("dialog").contains(refusal)).toBe(true);
});

it("says why a delete was refused and stays on the group", async () => {
  api.deleteStatus = 400;
  renderPage();

  await deleteNorth();

  expect(await screen.findByText("North still has members")).toBeTruthy();
  expect(screen.queryByText("Groups list")).toBeNull();
});
