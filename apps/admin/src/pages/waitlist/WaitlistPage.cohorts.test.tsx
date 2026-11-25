import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { INITIAL_WAITLIST_FILTER } from "../../lib/waitlistFilter";
import {
  api,
  pickMenuItem,
  renderPage,
  serveWaitlistApi,
} from "./WaitlistPage.testHarness";

const openCohortMenu = () =>
  fireEvent.click(screen.getByRole("button", { name: "Cohort actions" }));

serveWaitlistApi();

it("applies a cohort's filter and updates it with the current one", async () => {
  renderPage();
  await screen.findByText("person1@example.com");
  fireEvent.change(await screen.findByLabelText("Cohort"), {
    target: { value: "3" },
  });
  await waitFor(() =>
    expect(api.searches.at(-1)?.filter).toEqual({ mobilized: false }),
  );
  openCohortMenu();
  await screen.findByRole("menuitem", { name: "Save filter as cohort…" });
  expect(screen.queryByRole("menuitem", { name: /^Update/ })).toBeNull();
  fireEvent.keyDown(document.activeElement ?? document.body, {
    key: "Escape",
  });
  await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());

  fireEvent.change(screen.getByLabelText("Reason"), {
    target: { value: "true" },
  });
  await waitFor(() =>
    expect(api.searches.at(-1)?.filter).toEqual({
      mobilized: false,
      hasReason: true,
    }),
  );
  await pickMenuItem("Cohort actions", "Update cohort to this filter…");
  expect(
    await screen.findByText(/replaces its saved filter with the current one/),
  ).toBeTruthy();
  expect(api.posts).toEqual([]);
  fireEvent.click(screen.getByRole("button", { name: "Update cohort" }));
  await waitFor(() =>
    expect(api.posts).toEqual([
      {
        path: "/waitlist/admin/cohorts/3",
        body: { filter: { mobilized: false, hasReason: true } },
      },
    ]),
  );
  expect(await screen.findByText("Updated cohort “Waiting”")).toBeTruthy();
  openCohortMenu();
  await screen.findByRole("menuitem", { name: "Delete cohort…" });
  expect(screen.queryByRole("menuitem", { name: /^Update cohort/ })).toBeNull();
});

it("reverts a changed filter to the applied cohort's", async () => {
  renderPage();
  await screen.findByText("person1@example.com");
  fireEvent.change(await screen.findByLabelText("Cohort"), {
    target: { value: "3" },
  });
  fireEvent.change(screen.getByLabelText("Reason"), {
    target: { value: "true" },
  });
  await waitFor(() =>
    expect(api.searches.at(-1)?.filter).toEqual({
      mobilized: false,
      hasReason: true,
    }),
  );
  await pickMenuItem("Cohort actions", "Revert to the saved filter");
  await waitFor(() =>
    expect(api.searches.at(-1)?.filter).toEqual({ mobilized: false }),
  );
});

it("saves the current filter as a cohort", async () => {
  renderPage();
  await screen.findByText("person1@example.com");
  fireEvent.click(screen.getByRole("button", { name: /^Tag\s*·/ }));
  fireEvent.click(
    await screen.findByRole("menuitemcheckbox", { name: "Speakers" }),
  );
  await pickMenuItem("Cohort actions", "Save filter as cohort…");
  fireEvent.change(screen.getByLabelText("Cohort name"), {
    target: { value: "Speakers" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save cohort" }));
  await waitFor(() =>
    expect(api.posts).toEqual([
      {
        path: "/waitlist/admin/cohorts",
        body: {
          name: "Speakers",
          filter: { ...INITIAL_WAITLIST_FILTER, tagIds: [5] },
        },
      },
    ]),
  );
  expect(await screen.findByText("Saved cohort “Speakers”")).toBeTruthy();
  await waitFor(() =>
    expect(screen.getByLabelText("Cohort")).toHaveProperty("value", "4"),
  );
  openCohortMenu();
  expect(
    await screen.findByRole("menuitem", { name: "Delete cohort…" }),
  ).toBeTruthy();
});

it("deletes the applied cohort after confirming", async () => {
  renderPage();
  await screen.findByText("person1@example.com");
  fireEvent.change(await screen.findByLabelText("Cohort"), {
    target: { value: "3" },
  });
  await waitFor(() =>
    expect(screen.getByLabelText("Cohort")).toHaveProperty("value", "3"),
  );
  await pickMenuItem("Cohort actions", "Delete cohort…");
  expect(await screen.findByText(/No entry or tag changes/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Delete cohort" }));
  await waitFor(() =>
    expect(api.posts).toEqual([
      { path: "/waitlist/admin/cohorts/3", body: null },
    ]),
  );
  await waitFor(() =>
    expect(screen.getByLabelText("Cohort")).toHaveProperty("value", ""),
  );
  expect(
    within(screen.getByLabelText("Cohort")).queryByRole("option", {
      name: "Waiting",
    }),
  ).toBeNull();
});

it("keeps the typed name when a cohort name is taken", async () => {
  api.cohortCreateStatus = 409;
  renderPage();
  await screen.findByText("person1@example.com");
  await pickMenuItem("Cohort actions", "Save filter as cohort…");
  fireEvent.change(screen.getByLabelText("Cohort name"), {
    target: { value: "Waiting" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save cohort" }));
  expect(
    await screen.findByText("A cohort with that name already exists"),
  ).toBeTruthy();
  expect(screen.getByLabelText("Cohort name")).toHaveProperty(
    "value",
    "Waiting",
  );
});

it("drops a search still being typed when applying a cohort", async () => {
  renderPage();
  await screen.findByText("person1@example.com");
  const box = screen.getByLabelText("Search name, email, or phone");
  fireEvent.change(box, { target: { value: "pat" } });
  fireEvent.change(await screen.findByLabelText("Cohort"), {
    target: { value: "3" },
  });
  await new Promise((resolve) => setTimeout(resolve, 400));
  expect(api.searches.at(-1)?.filter).toEqual({ mobilized: false });
  expect(screen.getByLabelText("Search name, email, or phone")).toHaveProperty(
    "value",
    "",
  );
});

it("doesn't count a cohort's tags as not found while tags can't load", async () => {
  api.tagsStatus = 500;
  api.cohortsServed = [
    { ...api.cohortsServed[0], filter: { tagIds: [5], search: null } },
  ];
  renderPage();
  fireEvent.change(await screen.findByLabelText("Cohort"), {
    target: { value: "3" },
  });
  await waitFor(() =>
    expect(api.searches.at(-1)?.filter).toEqual({ tagIds: [5] }),
  );
  const tagFilter = screen.getByRole("button", { name: /^Tag ·/ });
  expect(tagFilter.textContent).toContain("1 selected");
  fireEvent.click(tagFilter);
  expect(await screen.findByText("Not loaded")).toBeTruthy();
  expect(screen.queryByRole("menuitem", { name: /not found/ })).toBeNull();
});
