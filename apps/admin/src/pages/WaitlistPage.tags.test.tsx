import { fireEvent, screen, waitFor } from "@testing-library/react";
import {
  api,
  pickMenuItem,
  renderPage,
  serveWaitlistApi,
} from "./WaitlistPage.testHarness";

serveWaitlistApi();

it("shows tags and tags or untags the selection", async () => {
  renderPage();
  expect(
    await screen.findByText("Speakers", { selector: "span" }),
  ).toBeTruthy();
  fireEvent.click(screen.getByLabelText("Select this page"));

  await pickMenuItem("Add tag", "Hosts");
  await waitFor(() =>
    expect(api.posts).toEqual([
      { path: "/waitlist/admin/tags/6/add", body: { entryIds: [1, 2] } },
    ]),
  );
  expect(await screen.findByText("Tagged 2 entries “Hosts”")).toBeTruthy();
  expect(screen.queryByText(/selected/)).toBeNull();

  fireEvent.click(screen.getByLabelText("Select this page"));
  await pickMenuItem("Remove tag", "Speakers");
  expect(
    await screen.findByText(/Removes the tag from any of the 2 selected/),
  ).toBeTruthy();
  expect(api.posts).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  await waitFor(() =>
    expect(api.posts.at(-1)).toEqual({
      path: "/waitlist/admin/tags/5/remove",
      body: { entryIds: [1, 2] },
    }),
  );
  expect(
    await screen.findByText("Removed “Speakers” from 1 entry"),
  ).toBeTruthy();
});

it("creates a tag for the selection", async () => {
  renderPage();
  fireEvent.click(await screen.findByLabelText("Select Person 1"));
  await pickMenuItem("Add tag", "New tag…");
  fireEvent.change(screen.getByLabelText("New tag name"), {
    target: { value: " Donors " },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create and tag" }));
  await waitFor(() =>
    expect(api.posts).toEqual([
      { path: "/waitlist/admin/tags", body: { name: "Donors" } },
      { path: "/waitlist/admin/tags/9/add", body: { entryIds: [1] } },
    ]),
  );
});

it("renames and deletes tags", async () => {
  renderPage();
  await screen.findByText("person1@example.com");
  fireEvent.click(screen.getByRole("button", { name: "Manage tags" }));
  const hosts = await screen.findByLabelText("Rename Hosts");
  fireEvent.change(hosts, { target: { value: "Co-hosts" } });
  fireEvent.blur(hosts);
  await waitFor(() =>
    expect(api.posts).toEqual([
      { path: "/waitlist/admin/tags/6", body: { name: "Co-hosts" } },
    ]),
  );

  fireEvent.click(screen.getByRole("button", { name: "Delete Speakers" }));
  expect(await screen.findByText(/removes the tag from 1 entry/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  await waitFor(() =>
    expect(api.posts.at(-1)).toEqual({
      path: "/waitlist/admin/tags/5",
      body: null,
    }),
  );
});

it("filters by tag", async () => {
  renderPage();
  await screen.findByText("person1@example.com");
  fireEvent.click(screen.getByRole("button", { name: /^Tag\s*·/ }));
  fireEvent.click(
    await screen.findByRole("menuitemcheckbox", { name: "Hosts" }),
  );
  await waitFor(() =>
    expect(api.searches.at(-1)?.filter).toEqual({ tagIds: [6] }),
  );
});

it("keeps a tag's name when a rename is refused", async () => {
  api.tagRenameStatus = 409;
  renderPage();
  await screen.findByText("person1@example.com");
  fireEvent.click(screen.getByRole("button", { name: "Manage tags" }));
  const hosts = await screen.findByLabelText("Rename Hosts");
  fireEvent.change(hosts, { target: { value: "Speakers" } });
  fireEvent.blur(hosts);
  expect(
    await screen.findByText("A tag with that name already exists"),
  ).toBeTruthy();
  expect(screen.getByLabelText("Rename Hosts")).toHaveProperty(
    "value",
    "Hosts",
  );
});

it("closes the new tag form once the tag exists, even if tagging fails", async () => {
  api.tagAddStatus = 500;
  renderPage();
  fireEvent.click(await screen.findByLabelText("Select Person 1"));
  await pickMenuItem("Add tag", "New tag…");
  fireEvent.change(screen.getByLabelText("New tag name"), {
    target: { value: "Donors" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create and tag" }));
  expect(await screen.findByText("Could not change tags.")).toBeTruthy();
  expect(screen.queryByLabelText("New tag name")).toBeNull();
});

it("shows and removes a filtered tag that no longer exists", async () => {
  renderPage();
  await screen.findByText("person1@example.com");
  fireEvent.click(screen.getByRole("button", { name: /^Tag\s*·/ }));
  fireEvent.click(
    await screen.findByRole("menuitemcheckbox", { name: "Hosts" }),
  );
  await waitFor(() =>
    expect(api.searches.at(-1)?.filter).toEqual({ tagIds: [6] }),
  );
  api.tagsServed = api.tagsServed.slice(0, 1);
  fireEvent.click(screen.getByRole("button", { name: "Manage tags" }));
  fireEvent.click(await screen.findByRole("button", { name: "Delete Hosts" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  await waitFor(() =>
    expect(screen.queryByLabelText("Rename Hosts")).toBeNull(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  await screen.findByRole("button", { name: /1 not found/, hidden: true });
  fireEvent.click(
    await screen.findByRole("menuitem", { name: "Remove 1 not found" }),
  );
  await waitFor(() => expect(api.searches.at(-1)?.filter).toEqual({}));
});

it("keeps the typed name when a new tag's name is taken", async () => {
  api.tagCreateStatus = 409;
  renderPage();
  fireEvent.click(await screen.findByLabelText("Select Person 1"));
  await pickMenuItem("Add tag", "New tag…");
  fireEvent.change(screen.getByLabelText("New tag name"), {
    target: { value: "Hosts" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create and tag" }));
  expect(
    await screen.findByText("A tag with that name already exists"),
  ).toBeTruthy();
  expect(screen.getByLabelText("New tag name")).toHaveProperty(
    "value",
    "Hosts",
  );
});

it("says why a tag can't be deleted, and keeps it", async () => {
  api.tagDeleteStatus = 409;
  renderPage();
  await screen.findByText("person1@example.com");
  fireEvent.click(screen.getByRole("button", { name: "Manage tags" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "Delete Speakers" }),
  );
  fireEvent.click(await screen.findByRole("button", { name: "Confirm" }));
  expect(
    await screen.findByText("Cohorts filter by this tag: Donors"),
  ).toBeTruthy();
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Confirm" })).toBeNull(),
  );
  expect(screen.getByLabelText("Rename Speakers")).toBeTruthy();
});

it("keeps the tags dialog shut until the tags load", async () => {
  api.tagsStatus = 500;
  renderPage();
  expect(await screen.findByText("Unable to load tags.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Manage tags" })).toHaveProperty(
    "disabled",
    true,
  );
});
