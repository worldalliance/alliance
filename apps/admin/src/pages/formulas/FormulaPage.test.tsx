import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { answerLeaveGuard } from "../../lib/testing/leaveGuard";
import { LOAD_FAILED_FALLBACK } from "../../ui/templates/States";
import {
  api,
  base,
  doubled,
  renderPage,
  serveFormulas,
  typeText,
} from "./FormulaPage.testHarness";

serveFormulas();

test("saves a new formula and moves to its page, focusing Save", async () => {
  const { router } = renderPage("/tasks/formulas/new");
  await screen.findByRole("heading", { name: "New formula" });
  typeText("Name", "tripled");
  typeText("Formula", "base * 3");
  fireEvent.click(screen.getByRole("button", { name: "Create formula" }));
  await waitFor(() =>
    expect(router.state.location.pathname).toBe(
      `/tasks/formulas/${api.saves[0].edits[0].id}`,
    ),
  );
  expect(api.saves[0]).toEqual({
    edits: [
      {
        id: expect.any(String),
        baseVersionId: null,
        name: "tripled",
        text: "base * 3",
        notes: null,
      },
    ],
    deletions: [],
    partFixes: [],
  });
  await screen.findByRole("heading", { name: "tripled" });
  await waitFor(() =>
    expect(document.activeElement?.textContent).toBe("Save changes"),
  );
  expect(api.listFetches).toBe(2);
});

test("opens on the fetched list rather than an older cached one", async () => {
  api.stored = [{ ...base, text: "3", versionId: 50 }, doubled];
  renderPage(`/tasks/formulas/${base.id}`, [base, doubled]);
  await screen.findByRole("heading", { name: "base" });
  expect(screen.getByLabelText(/^Formula/)).toHaveProperty("value", "3");
  typeText("Formula", "4");
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(() => expect(api.saves).toHaveLength(1));
  expect(api.saves[0].edits[0].baseVersionId).toBe(50);
});

test("shows a failed fetch rather than opening on a cached list", async () => {
  api.listFails = true;
  renderPage(`/tasks/formulas/${base.id}`, [base, doubled]);
  await screen.findByText("Couldn't load this formula");
  expect(screen.getByText(LOAD_FAILED_FALLBACK)).toBeTruthy();
  expect(screen.queryByLabelText(/^Formula/)).toBeNull();
});

test("opens a linked formula on a list fetched for it", async () => {
  renderPage(`/tasks/formulas/${doubled.id}`);
  await screen.findByRole("heading", { name: "doubled" });
  api.stored = [{ ...base, text: "3", versionId: 50 }, doubled];
  fireEvent.click(screen.getByRole("link", { name: "base" }));
  await screen.findByRole("heading", { name: "base" });
  expect(screen.getByLabelText(/^Formula/)).toHaveProperty("value", "3");
  typeText("Formula", "4");
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(() => expect(api.saves).toHaveLength(1));
  expect(api.saves[0].edits[0].baseVersionId).toBe(50);
});

test("keeps unsaved edits through a refresh that fails", async () => {
  const { client } = renderPage(`/tasks/formulas/${base.id}`);
  await screen.findByRole("heading", { name: "base" });
  typeText("Formula", "3");
  api.listFails = true;
  await act(() => client.invalidateQueries());
  // Query observers notify on a timer.
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
  expect(screen.getByLabelText(/^Formula/)).toHaveProperty("value", "3");
});

test("keeps the fields read-only while the list reloads after a save", async () => {
  renderPage(`/tasks/formulas/${base.id}`);
  await screen.findByRole("heading", { name: "base" });
  typeText("Formula", "3");
  let release = () => {};
  api.listHeld = new Promise((resolve) => (release = resolve));
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await screen.findByText("Saved.");
  expect(screen.getByLabelText(/^Formula/)).toHaveProperty("readOnly", true);
  expect(
    screen
      .getByRole("button", { name: "Save changes" })
      .getAttribute("aria-busy"),
  ).toBe("true");
  expect(screen.getByText("Saving…")).toBeTruthy();
  release();
  await waitFor(() =>
    expect(
      screen
        .getByRole("button", { name: "Save changes" })
        .getAttribute("aria-busy"),
    ).toBeNull(),
  );
  expect(screen.getByLabelText(/^Formula/)).toHaveProperty("readOnly", false);
  expect(screen.getByLabelText(/^Formula/)).toHaveProperty("value", "3");
});

test("gives focus back to Save once a save remounts the editor", async () => {
  renderPage(`/tasks/formulas/${base.id}`);
  await screen.findByRole("heading", { name: "base" });
  typeText("Formula", "3");
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await screen.findByText("Saved.");
  const save = await screen.findByRole("button", { name: "Save changes" });
  await waitFor(() => expect(document.activeElement).toBe(save));
});

test("stays where the admin went while a new formula's page loads", async () => {
  const { router } = renderPage("/tasks/formulas/new");
  await screen.findByRole("heading", { name: "New formula" });
  typeText("Name", "tripled");
  typeText("Formula", "base * 3");
  let release = () => {};
  api.listHeld = new Promise((resolve) => (release = resolve));
  fireEvent.click(screen.getByRole("button", { name: "Create formula" }));
  await screen.findByRole("status", { name: "Loading" });
  await act(() => router.navigate("/tasks/formulas"));
  await act(async () => {
    release();
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
  expect(router.state.location.pathname).toBe("/tasks/formulas");
});

test("keeps the saved text when the list can't load after a save", async () => {
  renderPage(`/tasks/formulas/${base.id}`);
  await screen.findByRole("heading", { name: "base" });
  typeText("Formula", "3");
  api.listFails = true;
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(
    await screen.findByText(
      "Saved, but couldn't load it again. Reload to see it.",
    ),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "Reload" })).toBeTruthy();
  expect(screen.getByLabelText(/^Formula/)).toHaveProperty("value", "3");
  expect(screen.getByLabelText(/^Formula/)).toHaveProperty("readOnly", true);
  expect(screen.queryByText(/Couldn't refresh formulas/)).toBeNull();
  expect(screen.getByText("Reload to keep editing")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(api.saves).toHaveLength(1);
});

test("keeps the save bar busy while a delete runs", async () => {
  renderPage(`/tasks/formulas/${doubled.id}`);
  await screen.findByRole("heading", { name: "doubled" });
  typeText("Notes", "x");
  let release = () => {};
  api.saveHeld = new Promise((resolve) => (release = resolve));
  fireEvent.click(screen.getByRole("button", { name: "Delete formula" }));
  const dialog = await screen.findByRole("dialog");
  fireEvent.click(
    Array.from(dialog.querySelectorAll("button")).find(
      (button) => button.textContent === "Delete formula",
    ) ?? dialog,
  );
  await waitFor(() => expect(api.saves).toHaveLength(1));
  expect(screen.getByText("Deleting…")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Discard" })).toHaveProperty(
    "disabled",
    true,
  );
  release();
  await screen.findByText("Deleted doubled.");
});

test("leaves without asking when the list can't load after a save", async () => {
  const confirm = answerLeaveGuard(false);
  const { router } = renderPage(`/tasks/formulas/${base.id}`);
  await screen.findByRole("heading", { name: "base" });
  typeText("Formula", "3");
  api.listFails = true;
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await screen.findByText("Saved, but couldn't load it again.", {
    exact: false,
  });
  await act(() => router.navigate("/tasks/formulas"));
  expect(router.state.location.pathname).toBe("/tasks/formulas");
  expect(confirm).not.toHaveBeenCalled();
  confirm.mockRestore();
});

test("moves to a new formula's page even when the list can't load after its save", async () => {
  renderPage("/tasks/formulas/new");
  await screen.findByRole("heading", { name: "New formula" });
  typeText("Name", "tripled");
  typeText("Formula", "base * 3");
  api.listFails = true;
  fireEvent.click(screen.getByRole("button", { name: "Create formula" }));
  // Only the new formula's page, not the editor, says this.
  await screen.findByText("Couldn't load this formula");
});

test("deletes after confirmation and returns to the list", async () => {
  const { router, client } = renderPage(`/tasks/formulas/${doubled.id}`);
  await screen.findByRole("heading", { name: "doubled" });
  typeText("Name", "half_typed");
  api.listHeld = new Promise(() => {});
  fireEvent.click(screen.getByRole("button", { name: "Delete formula" }));
  const dialog = await screen.findByRole("dialog");
  fireEvent.click(
    Array.from(dialog.querySelectorAll("button")).find(
      (button) => button.textContent === "Delete formula",
    ) ?? dialog,
  );
  await waitFor(() =>
    expect(router.state.location.pathname).toBe("/tasks/formulas"),
  );
  expect(screen.getByText("Deleted doubled.")).toBeTruthy();
  expect(client.getQueryData(queryKeys.formulasAdmin())).toEqual([base]);
  expect(api.saves).toEqual([
    {
      edits: [],
      deletions: [{ id: doubled.id, baseVersionId: 2 }],
      partFixes: [],
    },
  ]);
});

test("lists what it uses and what reads it", async () => {
  renderPage(`/tasks/formulas/${doubled.id}`);
  await screen.findByRole("heading", { name: "doubled" });
  expect(screen.getByRole("link", { name: "base" })).toBeTruthy();
  expect(screen.getByText("Nothing reads this formula yet.")).toBeTruthy();
});

test("says so for a formula that doesn't exist", async () => {
  renderPage("/tasks/formulas/00000000-0000-4000-8000-0000000000ff");
  expect(await screen.findByText("Formula not found")).toBeTruthy();
});

test("shows not found when Discard follows someone else's delete", async () => {
  const { client } = renderPage(`/tasks/formulas/${base.id}`);
  await screen.findByRole("heading", { name: "base" });
  api.stored = [doubled];
  await act(() => client.invalidateQueries());
  typeText("Formula", "3");
  fireEvent.click(screen.getByRole("button", { name: "Discard" }));
  await screen.findByText("Formula not found");
  expect(screen.queryByRole("button", { name: "Create formula" })).toBeNull();
});
