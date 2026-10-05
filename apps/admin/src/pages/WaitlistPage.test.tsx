import { fireEvent, screen, waitFor } from "@testing-library/react";
import { INITIAL_WAITLIST_FILTER } from "../lib/waitlistFilter";
import { api, renderPage, serveWaitlistApi } from "./WaitlistPage.testHarness";

serveWaitlistApi();

it("lists entries newest first with their total", async () => {
  renderPage();
  expect(await screen.findByText("person1@example.com")).toBeTruthy();
  expect(screen.getByText("I care")).toBeTruthy();
  expect(screen.getByText("2 entries")).toBeTruthy();
  expect(api.searches[0]).toEqual({
    filter: INITIAL_WAITLIST_FILTER,
    sort: "joined_desc",
    offset: 0,
    limit: 50,
  });
});

it("filters by a referrer and by status", async () => {
  renderPage();
  fireEvent.click(await screen.findByRole("button", { name: "Person 1" }));
  await waitFor(() =>
    expect(api.searches.at(-1)?.filter).toEqual({
      ...INITIAL_WAITLIST_FILTER,
      referrerIds: [1],
    }),
  );

  fireEvent.change(screen.getByLabelText("Mobilized"), {
    target: { value: "false" },
  });
  await waitFor(() =>
    expect(api.searches.at(-1)?.filter).toEqual({
      ...INITIAL_WAITLIST_FILTER,
      referrerIds: [1],
      mobilized: false,
    }),
  );

  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  await waitFor(() =>
    expect(api.searches.at(-1)?.filter).toEqual(INITIAL_WAITLIST_FILTER),
  );
  expect(screen.queryByRole("button", { name: "Clear filters" })).toBeNull();
});

it("shows metrics for the current filter", async () => {
  renderPage();
  fireEvent.click(await screen.findByRole("button", { name: "Metrics" }));
  expect(
    await screen.findByText("For the 2 entries", { exact: false }),
  ).toBeTruthy();

  fireEvent.change(screen.getByLabelText("Mobilized"), {
    target: { value: "false" },
  });
  await waitFor(() =>
    expect(api.posts.filter((post) => post.path.endsWith("/metrics"))).toEqual([
      {
        path: "/waitlist/admin/entries/metrics",
        body: { filter: INITIAL_WAITLIST_FILTER },
      },
      {
        path: "/waitlist/admin/entries/metrics",
        body: { filter: { ...INITIAL_WAITLIST_FILTER, mobilized: false } },
      },
    ]),
  );

  fireEvent.click(screen.getByRole("button", { name: "Metrics" }));
  expect(screen.queryByRole("region", { name: "Metrics" })).toBeNull();
});

it("refreshes open metrics after marking entries mobilized", async () => {
  renderPage();
  fireEvent.click(await screen.findByRole("button", { name: "Metrics" }));
  await screen.findByRole("region", { name: "Metrics" });
  fireEvent.click(screen.getByLabelText("Select Person 2"));
  fireEvent.click(screen.getByRole("button", { name: "Mark mobilized" }));
  fireEvent.click(await screen.findByRole("button", { name: "Confirm" }));

  await waitFor(() =>
    expect(api.posts.map((post) => post.path)).toEqual([
      "/waitlist/admin/entries/metrics",
      "/waitlist/admin/entries/mobilize",
      "/waitlist/admin/entries/metrics",
    ]),
  );
});

it("clears a referrer filter from its chip", async () => {
  renderPage();
  fireEvent.click(await screen.findByRole("button", { name: "Person 1" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "Clear referrer filter" }),
  );
  await waitFor(() =>
    expect(api.searches.at(-1)?.filter).toEqual(INITIAL_WAITLIST_FILTER),
  );
});

it("pages through entries and returns to the first page on a new filter", async () => {
  api.searchTotal = 120;
  renderPage();
  await screen.findByText("person1@example.com");
  fireEvent.click(screen.getByRole("button", { name: "2" }));
  await waitFor(() => expect(api.searches.at(-1)?.offset).toBe(50));

  fireEvent.change(screen.getByLabelText("Mobilized"), {
    target: { value: "false" },
  });
  await waitFor(() =>
    expect(api.searches.at(-1)).toMatchObject({
      filter: { mobilized: false },
      offset: 0,
    }),
  );
});

it("clears a search still being typed", async () => {
  renderPage();
  await screen.findByText("person1@example.com");
  fireEvent.change(screen.getByLabelText("Mobilized"), {
    target: { value: "false" },
  });
  const box = screen.getByLabelText("Search name or email");
  fireEvent.change(box, { target: { value: "pat" } });
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  await new Promise((resolve) => setTimeout(resolve, 400));
  expect(api.searches.at(-1)?.filter).toEqual(INITIAL_WAITLIST_FILTER);
  expect(box).toHaveProperty("value", "");
});

it("searches after typing stops", async () => {
  renderPage();
  await screen.findByText("person1@example.com");
  fireEvent.change(screen.getByLabelText("Search name or email"), {
    target: { value: "  pat " },
  });
  await waitFor(() =>
    expect(api.searches.at(-1)?.filter).toEqual({
      ...INITIAL_WAITLIST_FILTER,
      search: "pat",
    }),
  );
});

it("sorts by organization from the first page", async () => {
  api.searchTotal = 120;
  renderPage();
  await screen.findByText("person1@example.com");
  fireEvent.click(screen.getByRole("button", { name: "2" }));
  await waitFor(() => expect(api.searches.at(-1)?.offset).toBe(50));
  fireEvent.click(screen.getByRole("button", { name: "Organization" }));
  await waitFor(() => expect(api.searches.at(-1)?.offset).toBe(0));
  await waitFor(() =>
    expect(api.searches.at(-1)?.sort).toBe("organization_asc"),
  );
  fireEvent.click(screen.getByRole("button", { name: "Organization" }));
  await waitFor(() =>
    expect(api.searches.at(-1)?.sort).toBe("organization_desc"),
  );
});

it("says the waitlist failed to load", async () => {
  api.searchStatus = 500;
  renderPage();
  expect(await screen.findByText("Unable to load the waitlist.")).toBeTruthy();
  expect(screen.queryByText("Loading…")).toBeNull();
});

it("toggles an invite state filter", async () => {
  renderPage();
  await screen.findByText("person1@example.com");
  fireEvent.click(screen.getByRole("button", { name: /^Invite/ }));
  const unused = await screen.findByRole("menuitemcheckbox", {
    name: "Unused",
  });
  fireEvent.click(unused);
  await waitFor(() =>
    expect(api.searches.at(-1)?.filter).toEqual({
      ...INITIAL_WAITLIST_FILTER,
      inviteStates: ["unused"],
    }),
  );
  fireEvent.click(unused);
  await waitFor(() =>
    expect(api.searches.at(-1)?.filter).toEqual(INITIAL_WAITLIST_FILTER),
  );
});

it("filters by an inclusive join date range", async () => {
  renderPage();
  await screen.findByText("person1@example.com");
  fireEvent.change(screen.getByLabelText("Joined on or after"), {
    target: { value: "2026-09-01" },
  });
  fireEvent.change(screen.getByLabelText("Joined on or before"), {
    target: { value: "2026-09-10" },
  });
  await waitFor(() =>
    expect(api.searches.at(-1)?.filter).toEqual({
      ...INITIAL_WAITLIST_FILTER,
      joinedFrom: new Date("2026-09-01T00:00").toISOString(),
      joinedBefore: new Date("2026-09-11T00:00").toISOString(),
    }),
  );
});

it("filters by organization and by link", async () => {
  renderPage();
  await screen.findByText("person1@example.com");
  fireEvent.click(screen.getByRole("button", { name: /^Organization\s*·/ }));
  expect(
    screen.queryByRole("menuitemcheckbox", { name: "Spring drive" }),
  ).toBeNull();
  fireEvent.click(
    await screen.findByRole("menuitemcheckbox", { name: "Acme" }),
  );
  await waitFor(() =>
    expect(api.searches.at(-1)?.filter).toEqual({
      ...INITIAL_WAITLIST_FILTER,
      organizationIds: [7],
    }),
  );

  fireEvent.click(screen.getByRole("button", { name: /^Link\s*·/ }));
  fireEvent.click(
    await screen.findByRole("menuitemcheckbox", { name: "Acme · Newsletter" }),
  );
  await waitFor(() =>
    expect(api.searches.at(-1)?.filter).toEqual({
      ...INITIAL_WAITLIST_FILTER,
      organizationIds: [7],
      sourceLinkIds: [9],
    }),
  );
});

it("marks the selected entries mobilized after confirming", async () => {
  renderPage();
  fireEvent.click(await screen.findByLabelText("Select Person 2"));
  expect(screen.getByText("1 entry is selected")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Mark mobilized" }));
  expect(await screen.findByText(/sends no email/)).toBeTruthy();
  expect(api.posts).toEqual([]);
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

  await waitFor(() =>
    expect(api.posts).toEqual([
      { path: "/waitlist/admin/entries/mobilize", body: { entryIds: [2] } },
    ]),
  );
  expect(await screen.findByText("Marked 1 entry mobilized")).toBeTruthy();
  expect(screen.queryByText(/selected/)).toBeNull();
  await waitFor(() => expect(api.searches).toHaveLength(2));
});

it("selects every matching entry across pages, and undoes their mobilization", async () => {
  renderPage();
  await screen.findByText("person1@example.com");
  fireEvent.change(screen.getByLabelText("Mobilized"), {
    target: { value: "true" },
  });
  await waitFor(() =>
    expect(api.searches.at(-1)?.filter).toEqual({
      ...INITIAL_WAITLIST_FILTER,
      mobilized: true,
    }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Select all 2 matching" }),
  );
  expect(await screen.findByText("3 entries are selected")).toBeTruthy();
  expect(api.posts[0]).toEqual({
    path: "/waitlist/admin/entries/ids",
    body: { filter: { ...INITIAL_WAITLIST_FILTER, mobilized: true } },
  });

  fireEvent.click(screen.getByRole("button", { name: "Undo mobilized" }));
  expect(await screen.findByText(/stays usable/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  await waitFor(() =>
    expect(api.posts.at(-1)).toEqual({
      path: "/waitlist/admin/entries/unmobilize",
      body: { entryIds: [1, 2, 3] },
    }),
  );
});

it("revokes the selected entries' unused invites after confirming", async () => {
  renderPage();
  fireEvent.click(await screen.findByLabelText("Select Person 1"));
  fireEvent.click(screen.getByRole("button", { name: "Revoke invites" }));
  expect(await screen.findByText(/signup links stop working/)).toBeTruthy();
  expect(api.posts).toEqual([]);
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

  await waitFor(() =>
    expect(api.posts).toEqual([
      {
        path: "/waitlist/admin/entries/revoke-invites",
        body: { entryIds: [1] },
      },
    ]),
  );
  expect(await screen.findByText("Revoked 3 invites")).toBeTruthy();
});

it("says revoking failed when the server gives no reason", async () => {
  api.revokeStatus = 500;
  renderPage();
  fireEvent.click(await screen.findByLabelText("Select Person 1"));
  fireEvent.click(screen.getByRole("button", { name: "Revoke invites" }));
  fireEvent.click(await screen.findByRole("button", { name: "Confirm" }));
  expect(await screen.findByText("Could not revoke the invites.")).toBeTruthy();
});

it("shows a partly selected page as indeterminate", async () => {
  renderPage();
  fireEvent.click(await screen.findByLabelText("Select Person 1"));
  const header = screen.getByLabelText("Select this page");
  expect(header).toHaveProperty("indeterminate", true);
  fireEvent.click(screen.getByLabelText("Select Person 2"));
  expect(header).toHaveProperty("indeterminate", false);
  expect(header).toHaveProperty("checked", true);
});

it("clears the selection when the filter changes", async () => {
  renderPage();
  fireEvent.click(await screen.findByLabelText("Select this page"));
  expect(screen.getByText("2 entries are selected")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Reason"), {
    target: { value: "true" },
  });
  await waitFor(() => expect(screen.queryByText(/selected/)).toBeNull());
});

it("ignores a select-all answer for a filter since changed", async () => {
  let release = () => {};
  api.holdIds = new Promise((resolve) => {
    release = resolve;
  });
  renderPage();
  fireEvent.click(
    await screen.findByRole("button", { name: "Select all 2 matching" }),
  );
  fireEvent.change(screen.getByLabelText("Reason"), {
    target: { value: "true" },
  });
  await waitFor(() =>
    expect(api.searches.at(-1)?.filter).toEqual({
      ...INITIAL_WAITLIST_FILTER,
      hasReason: true,
    }),
  );
  release();
  await waitFor(() => expect(api.posts).toHaveLength(1));
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Select all 2 matching" }),
    ).toHaveProperty("disabled", false),
  );
  expect(screen.queryByText(/selected/)).toBeNull();
});

it("ignores a select-all answer once the selection has since changed", async () => {
  let release = () => {};
  api.holdIds = new Promise((resolve) => {
    release = resolve;
  });
  renderPage();
  fireEvent.click(await screen.findByLabelText("Select Person 1"));
  fireEvent.click(
    screen.getByRole("button", { name: "Select all 2 matching" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
  release();
  await waitFor(() => expect(api.posts).toHaveLength(1));
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Select all 2 matching" }),
    ).toHaveProperty("disabled", false),
  );
  expect(screen.queryByText(/selected/)).toBeNull();
});

it("changes only the entries selected when the confirmation opened", async () => {
  let release = () => {};
  api.holdIds = new Promise((resolve) => {
    release = resolve;
  });
  renderPage();
  fireEvent.click(await screen.findByLabelText("Select Person 2"));
  fireEvent.click(
    screen.getByRole("button", { name: "Select all 2 matching" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Mark mobilized" }));
  expect(await screen.findByText(/among 1 selected entry/)).toBeTruthy();
  release();
  expect(await screen.findByText("3 entries are selected")).toBeTruthy();
  expect(screen.getByText(/among 1 selected entry/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  await waitFor(() =>
    expect(api.posts.at(-1)).toEqual({
      path: "/waitlist/admin/entries/mobilize",
      body: { entryIds: [2] },
    }),
  );
});

it("moves back to the last page once entries leave it", async () => {
  api.searchTotal = 120;
  renderPage();
  await screen.findByText("person1@example.com");
  fireEvent.click(screen.getByRole("button", { name: "3" }));
  await waitFor(() => expect(api.searches.at(-1)?.offset).toBe(100));

  api.searchTotal = 60;
  fireEvent.click(screen.getByLabelText("Select this page"));
  fireEvent.click(screen.getByRole("button", { name: "Mark mobilized" }));
  fireEvent.click(await screen.findByRole("button", { name: "Confirm" }));
  await waitFor(() => expect(api.searches.at(-1)?.offset).toBe(50));
});

it("keeps the selection and says why when mobilizing fails", async () => {
  api.mobilizeStatus = 403;
  renderPage();
  fireEvent.click(await screen.findByLabelText("Select Person 2"));
  fireEvent.click(screen.getByRole("button", { name: "Mark mobilized" }));
  fireEvent.click(await screen.findByRole("button", { name: "Confirm" }));
  expect(await screen.findByText("Refused")).toBeTruthy();
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Confirm" })).toBeNull(),
  );
  expect(screen.getByText("1 entry is selected")).toBeTruthy();
});

it("disables selection while the previous filter's rows still show", async () => {
  renderPage();
  await screen.findByText("person1@example.com");
  let release = () => {};
  api.holdSearch = new Promise((resolve) => {
    release = resolve;
  });
  fireEvent.change(screen.getByLabelText("Reason"), {
    target: { value: "true" },
  });
  await waitFor(() =>
    expect(screen.getByLabelText("Select Person 1")).toHaveProperty(
      "disabled",
      true,
    ),
  );
  expect(
    screen.getByRole("button", { name: "Select all 2 matching" }),
  ).toHaveProperty("disabled", true);
  release();
  await waitFor(() =>
    expect(screen.getByLabelText("Select Person 1")).toHaveProperty(
      "disabled",
      false,
    ),
  );
});
