import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { answerLeaveGuard } from "../../lib/testing/leaveGuard";
import {
  api,
  onVolunteers,
  partReadsVolunteers,
  readsVolunteers,
  remove,
  renderPage,
  serveMemberListPageApi,
  volunteers,
} from "./memberListPageTesting";

serveMemberListPageApi();

test("shows the formulas a delete would break, and deletes with the fix", async () => {
  api.formulaAnswers = [[readsVolunteers], []];
  const router = renderPage(`/members/lists/${volunteers.id}`);
  await screen.findByRole("heading", { name: "Volunteers" });
  fireEvent.click(screen.getByRole("button", { name: "Delete list" }));
  fireEvent.click(
    within(await screen.findByRole("dialog")).getByRole("button", {
      name: "Delete list",
    }),
  );
  expect(
    await screen.findByText("This uses a list that no longer exists."),
  ).toBeTruthy();
  expect(api.formulaSaves[0]).toEqual({
    edits: [],
    deletions: [],
    deletedLists: [{ id: volunteers.id, baseVersionId: 5 }],
    partFixes: [],
  });
  fireEvent.click(screen.getByRole("button", { name: "Fix it in this save" }));
  fireEvent.change(await screen.findByLabelText(/^Formula/), {
    target: { value: "false" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Delete list" }));
  fireEvent.click(
    within(await screen.findByRole("dialog")).getByRole("button", {
      name: "Delete list",
    }),
  );
  await waitFor(() =>
    expect(router.state.location.pathname).toBe("/members/lists"),
  );
  expect(api.formulaSaves[1]).toEqual({
    edits: [
      {
        id: onVolunteers.id,
        baseVersionId: 9,
        name: "onVolunteers",
        text: "false",
        notes: null,
      },
    ],
    deletions: [],
    deletedLists: [{ id: volunteers.id, baseVersionId: 5 }],
    partFixes: [],
  });
});

test("deletes a list with the fix of a part that reads it", async () => {
  api.formulaAnswers = [[partReadsVolunteers], []];
  const router = renderPage(`/members/lists/${volunteers.id}`);
  await screen.findByRole("heading", { name: "Volunteers" });
  await remove();
  fireEvent.click(
    await screen.findByRole("button", { name: "Fix it in this save" }),
  );
  fireEvent.change(screen.getByRole("textbox", { name: "Condition" }), {
    target: { value: "false" },
  });
  await remove();

  await waitFor(() =>
    expect(router.state.location.pathname).toBe("/members/lists"),
  );
  expect(api.formulaSaves[1].partFixes).toEqual([
    {
      suiteId: 4,
      baseVersionId: 2,
      partId: "part-1",
      text: "false",
      fallback: null,
    },
  ]);
});

test("asks before leaving while a part's fix differs from how it opened", async () => {
  api.formulaAnswers = [[partReadsVolunteers]];
  const confirm = answerLeaveGuard(false);
  const router = renderPage(`/members/lists/${volunteers.id}`);
  await screen.findByRole("heading", { name: "Volunteers" });
  await remove();
  fireEvent.click(
    await screen.findByRole("button", { name: "Fix it in this save" }),
  );
  const condition = () => screen.getByRole("textbox", { name: "Condition" });
  fireEvent.change(condition(), { target: { value: "false" } });
  await act(() => router.navigate("/members/lists"));
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(router.state.location.pathname).toBe(
    `/members/lists/${volunteers.id}`,
  );

  fireEvent.change(condition(), {
    target: { value: partReadsVolunteers.text },
  });
  await act(() => router.navigate("/members/lists"));
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(router.state.location.pathname).toBe("/members/lists");
  confirm.mockRestore();
});

test("opens on fetched formulas, not cached ones a fix would conflict with", async () => {
  let release = () => {};
  api.formulasHeld = new Promise((resolve) => (release = resolve));
  api.formulaAnswers = [[readsVolunteers]];
  renderPage(`/members/lists/${volunteers.id}`, [
    { ...onVolunteers, versionId: 8 },
  ]);
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(screen.queryByRole("heading", { name: "Volunteers" })).toBeNull();
  release();
  await screen.findByRole("heading", { name: "Volunteers" });
  fireEvent.click(screen.getByRole("button", { name: "Delete list" }));
  fireEvent.click(
    within(await screen.findByRole("dialog")).getByRole("button", {
      name: "Delete list",
    }),
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Fix it in this save" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Delete list" }));
  fireEvent.click(
    within(await screen.findByRole("dialog")).getByRole("button", {
      name: "Delete list",
    }),
  );
  await waitFor(() =>
    expect(api.formulaSaves[1]?.edits[0]?.baseVersionId).toBe(9),
  );
});

test("disables Save, Discard and the member picker while a delete runs", async () => {
  api.formulaSaveHeld = new Promise(() => {});
  renderPage(`/members/lists/${volunteers.id}`);
  await screen.findByRole("heading", { name: "Volunteers" });
  fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "H" } });
  await remove();
  await waitFor(() => expect(api.formulaSaves).toHaveLength(1));
  const disabled = ["Save changes", "Discard"].map((name) =>
    screen.getByRole("button", { name }).hasAttribute("disabled"),
  );
  expect(disabled).toEqual([true, true]);
  expect(screen.getByLabelText(/^Members/).hasAttribute("disabled")).toBe(true);
});
