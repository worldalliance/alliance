import type { FormulaProblemDto } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import {
  api,
  base,
  breaksDoubled,
  doubled,
  renderPage,
  serveFormulas,
  typeText,
} from "./FormulaPage.testHarness";

serveFormulas();

test("shows what a save would break, and saves the fix with it", async () => {
  api.answers = [[breaksDoubled], []];
  renderPage(`/formulas/${base.id}`);
  await screen.findByRole("heading", { name: "base" });
  typeText("Formula", '"two"');
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(
    await screen.findByText("The left of this operator has to be a number."),
  ).toBeTruthy();
  expect(
    screen.getByText(
      "Nothing was saved. Fix the problems below, then save again.",
    ),
  ).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Fix it in this save" }));
  expect(document.activeElement).toBe(
    screen.getByRole("heading", { name: "Fixing doubled in this save" }),
  );
  typeText("Formula", "base + base", 1);
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(api.saves).toHaveLength(2));
  expect(
    api.saves[1].edits.map(({ id, baseVersionId, text }) => ({
      id,
      baseVersionId,
      text,
    })),
  ).toEqual([
    { id: base.id, baseVersionId: 1, text: '"two"' },
    { id: doubled.id, baseVersionId: 2, text: "base + base" },
  ]);
  await waitFor(() =>
    expect(screen.queryByText("Fixing", { exact: false })).toBeNull(),
  );
});

test("saves a part's fix with the formula", async () => {
  const gated: FormulaProblemDto = {
    kind: "dependent",
    id: "partition:7:part-1",
    text: "base",
    diagnostics: [{ message: "This is undecided.", start: 0, end: 4 }],
    partition: {
      suiteId: 7,
      suiteName: "Week 12",
      versionId: 3,
      partId: "part-1",
      partName: "Gated",
      fallback: null,
    },
  };
  api.answers = [[gated], []];
  const { client } = renderPage(`/formulas/${base.id}`);
  const partition = queryKeys.suitePartitionAdmin(7);
  client.setQueryData(partition, {});
  await screen.findByRole("heading", { name: "base" });
  typeText("Formula", "null");
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "Fix it in this save" }),
  );
  const condition = screen.getByRole("textbox", { name: "Condition" });
  expect(condition.getAttribute("aria-invalid")).toBe("true");
  expect(
    screen.getByText('A yes/no formula, such as isOnList("Volunteers").').id,
  ).toBe(condition.getAttribute("aria-describedby")?.split(" ")[0]);
  fireEvent.change(
    screen.getByRole("combobox", { name: /When the condition is undecided/ }),
    { target: { value: "continue" } },
  );
  fireEvent.click(screen.getByRole("button", { name: "Save" }));

  await waitFor(() => expect(api.saves).toHaveLength(2));
  expect(api.saves[1].partFixes).toEqual([
    {
      suiteId: 7,
      baseVersionId: 3,
      partId: "part-1",
      text: "base",
      fallback: "continue",
    },
  ]);
  await waitFor(() =>
    expect(screen.queryByText("Fixing", { exact: false })).toBeNull(),
  );
  expect(client.getQueryState(partition)?.isInvalidated).toBe(true);
});

test("opens a fix with the names the save gives", async () => {
  api.answers = [[{ ...breaksDoubled, text: "bar * 2" }]];
  renderPage(`/formulas/${base.id}`);
  await screen.findByRole("heading", { name: "base" });
  typeText("Name", "bar");
  typeText("Formula", '"two"');
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "Fix it in this save" }),
  );
  expect(screen.getAllByLabelText(/^Formula/)[1]).toHaveProperty(
    "value",
    "bar * 2",
  );
});

test("says to reload when someone else saved first", async () => {
  api.answers = [409];
  renderPage(`/formulas/${base.id}`);
  await screen.findByRole("heading", { name: "base" });
  typeText("Formula", "3");
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(
    await screen.findByText(
      "`base` was changed since you opened it. Reload to see the latest version.",
    ),
  ).toBeTruthy();
  const assign = jest
    .spyOn(window.location, "assign")
    .mockImplementation(() => {});
  fireEvent.click(screen.getByRole("button", { name: "Reload" }));
  expect(assign).toHaveBeenCalledWith(`/formulas/${base.id}`);
  assign.mockRestore();
});

test("reloads an unsaved new formula to a blank one", async () => {
  api.answers = [[breaksDoubled], 409];
  renderPage("/formulas/new");
  await screen.findByRole("heading", { name: "New formula" });
  typeText("Name", "tripled");
  typeText("Formula", "base * 3");
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "Fix it in this save" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  const assign = jest
    .spyOn(window.location, "assign")
    .mockImplementation(() => {});
  fireEvent.click(await screen.findByRole("button", { name: "Reload" }));
  await waitFor(() => expect(assign).toHaveBeenCalledWith("/formulas/new"));
  assign.mockRestore();
});

test("reloads a new formula to its page when a lost answer hid its save", async () => {
  api.answers = [500, 409];
  renderPage("/formulas/new");
  await screen.findByRole("heading", { name: "New formula" });
  typeText("Name", "tripled");
  typeText("Formula", "base * 3");
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await screen.findByText("Couldn't save.");
  const { id } = api.saves[0].edits[0];
  api.stored = [
    ...api.stored,
    { ...base, id, name: "tripled", text: "base * 3" },
  ];
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  const assign = jest
    .spyOn(window.location, "assign")
    .mockImplementation(() => {});
  fireEvent.click(await screen.findByRole("button", { name: "Reload" }));
  await waitFor(() => expect(assign).toHaveBeenCalledWith(`/formulas/${id}`));
  assign.mockRestore();
});

test("offers no reload for a save refused for another reason", async () => {
  api.answers = [400];
  renderPage(`/formulas/${base.id}`);
  await screen.findByRole("heading", { name: "base" });
  typeText("Formula", "3");
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await screen.findByText("was changed since you opened it", { exact: false });
  expect(screen.queryByRole("button", { name: "Reload" })).toBeNull();
});

test("keeps unsaved edits when the list refreshes with a newer version", async () => {
  const { client } = renderPage(`/formulas/${base.id}`);
  await screen.findByRole("heading", { name: "base" });
  typeText("Formula", "3");
  api.stored = [{ ...base, text: "7", versionId: 5 }, doubled];
  await act(() => client.invalidateQueries());
  expect(screen.getByLabelText(/^Formula/)).toHaveProperty("value", "3");
  api.answers = [409];
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await screen.findByRole("button", { name: "Reload" });
  expect(api.saves[0].edits[0].baseVersionId).toBe(1);
});

test("links a problem in a formula newer than the page to its own page", async () => {
  const newer = "00000000-0000-4000-8000-00000000000c";
  api.answers = [[{ ...breaksDoubled, id: newer }]];
  renderPage(`/formulas/${base.id}`);
  await screen.findByRole("heading", { name: "base" });
  typeText("Formula", '"two"');
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  const link = await screen.findByRole("link", {
    name: `${newer} opens in new tab`,
  });
  expect(link.getAttribute("href")).toBe(`/formulas/${newer}`);
  expect(
    screen.getByText(
      "Added since this page opened, so fix it on its own page.",
    ),
  ).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "Fix it in this save" }),
  ).toBeNull();
});

test("says to delete again when a delete is refused", async () => {
  api.answers = [[breaksDoubled], []];
  const { router } = renderPage(`/formulas/${base.id}`);
  await screen.findByRole("heading", { name: "base" });
  fireEvent.click(screen.getByRole("button", { name: "Delete formula" }));
  const confirm = () =>
    fireEvent.click(
      Array.from(screen.getByRole("dialog").querySelectorAll("button")).find(
        (button) => button.textContent === "Delete formula",
      ) ?? screen.getByRole("dialog"),
    );
  await screen.findByRole("dialog");
  confirm();
  expect(
    await screen.findByText(
      "Nothing was deleted. Fix the problems below, then delete again.",
    ),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Fix it in this save" }));
  typeText("Formula", "2", 1);
  fireEvent.click(screen.getByRole("button", { name: "Delete formula" }));
  await screen.findByRole("dialog");
  confirm();
  await waitFor(() => expect(router.state.location.pathname).toBe("/formulas"));
  expect(api.saves[1]).toEqual({
    edits: [expect.objectContaining({ id: doubled.id, text: "2" })],
    deletions: [{ id: base.id, baseVersionId: 1 }],
    partFixes: [],
  });
});

test("drops a fix's problems when the admin stops fixing it", async () => {
  api.answers = [[breaksDoubled], [{ ...breaksDoubled, text: "base + oops" }]];
  renderPage(`/formulas/${base.id}`);
  await screen.findByRole("heading", { name: "base" });
  typeText("Formula", '"two"');
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await screen.findByText("Problems in other formulas and parts");
  fireEvent.click(screen.getByRole("button", { name: "Fix it in this save" }));
  typeText("Formula", "base + oops", 1);
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(api.saves).toHaveLength(2));
  await screen.findByRole("button", { name: "Save" });
  fireEvent.click(screen.getByRole("button", { name: "Stop fixing it" }));
  expect(screen.queryByText("Problems in other formulas and parts")).toBeNull();
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "Save" }),
  );
});
