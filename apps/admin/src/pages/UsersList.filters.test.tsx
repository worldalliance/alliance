import { makeUser } from "@alliance/shared/lib/testFixtures";
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  api,
  check,
  chips,
  openFilters,
  renderPage,
  search,
  serveUsersListApi,
  shownNames,
} from "./UsersList.testHarness";

serveUsersListApi();

it("shows only signed members by default, as a chip that removes the filter", async () => {
  api.users = [...api.users, makeUser({ id: 4, name: "Kim" })];
  renderPage();
  await screen.findByText("Ada");

  expect(shownNames()).toEqual(["Ada", "Sam", "Lee"]);
  expect(chips()).toEqual(["Contract: Signed"]);
  expect(screen.getByText("3 of 4")).toBeTruthy();

  fireEvent.click(
    screen.getByRole("button", { name: "Remove filter: Contract: Signed" }),
  );
  expect(shownNames()).toEqual(["Ada", "Sam", "Lee", "Kim"]);
  expect(screen.getByText("4")).toBeTruthy();
});

it("filters by role, counting each role's members", async () => {
  renderPage();
  await screen.findByText("Ada");
  const popup = await openFilters();
  const role = within(within(popup).getByRole("group", { name: "Role" }));
  expect(
    role.getByRole("checkbox", { name: /^Admin ?, 1 matching$/ }),
  ).toBeTruthy();
  expect(
    role.getByRole("checkbox", { name: /^Staff ?, 2 matching$/ }),
  ).toBeTruthy();

  fireEvent.click(role.getByRole("checkbox", { name: /Admin/ }));
  expect(shownNames()).toEqual(["Ada"]);
  expect(chips()).toContain("Role: Admin");

  fireEvent.click(role.getByRole("checkbox", { name: /Staff/ }));
  expect(shownNames()).toEqual(["Ada", "Sam", "Lee"]);
  expect(chips()).toContain("Role: Admin, Staff");
});

it("filters by tag", async () => {
  renderPage();
  await screen.findByText("Ada");

  await check("Tag", /Volunteers/);
  expect(shownNames()).toEqual(["Lee"]);

  await check("Tag", /Donors/);
  expect(shownNames()).toEqual(["Sam", "Lee"]);
  expect(chips()).toContain("Tag: Volunteers, Donors");
});

it("shows a link's deleted tag as a chip that matches nobody", async () => {
  renderPage("?view=grid&tag=gone");
  await screen.findByText("No members match these filters.");

  expect(chips()).toEqual(["Tag: Unknown tag (gone)", "Contract: Signed"]);
});

it("keeps a link's deleted tag when another tag changes", async () => {
  renderPage("?view=grid&tag=gone,t1");
  await screen.findByText("Lee");

  await check("Tag", /Volunteers/);
  expect(new URLSearchParams(api.location).get("tag")).toBe("gone");
});

it("keeps every linked tag that failed to load when one is unchecked", async () => {
  api.tagsStatus = 500;
  renderPage("?view=grid&tag=t1,t2");
  await screen.findByText(/^Couldn't load tags/);

  await check("Tag", /Unavailable \(t1\)/);
  expect(new URLSearchParams(api.location).get("tag")).toBe("t2");
});

it("doesn't call a linked tag unknown when tags fail to load", async () => {
  api.tagsStatus = 500;
  renderPage("?view=grid&tag=t1");
  await screen.findByText(/^Couldn't load tags/);

  expect(chips()).toEqual(["Tag: Unavailable (t1)", "Contract: Signed"]);
  expect(shownNames()).toEqual(["Ada", "Sam", "Lee"]);
});

it("waits for tags before filtering a link by one", async () => {
  let release = () => {};
  api.tagsGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  renderPage("?view=grid&tag=t1");
  await screen.findByText("Loading members…");
  await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
  expect(screen.getByText("Loading members…")).toBeTruthy();
  expect(chips()).toContain("Tag: Loading… (t1)");

  release();
  await waitFor(() => expect(shownNames()).toEqual(["Lee"]));
});

it("leaves out action progress counts until progress loads", async () => {
  let release = () => {};
  api.relationsGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  renderPage();
  await screen.findByText("Ada");
  const actions = within(await openFilters()).getByRole("group", {
    name: "Actions",
  });
  expect(
    within(actions).getByRole("checkbox", { name: "Caught up" }),
  ).toBeTruthy();
  expect(
    within(actions).getByRole("checkbox", { name: "Not caught up" }),
  ).toBeTruthy();
  release();
  expect(
    await within(actions).findByRole("checkbox", {
      name: /^Caught up ?, 1 matching$/,
    }),
  ).toBeTruthy();
  expect(
    within(actions).getByRole("checkbox", {
      name: /^Not caught up ?, 2 matching$/,
    }),
  ).toBeTruthy();
});

it("says when tags fail to load", async () => {
  api.tagsStatus = 500;
  renderPage();
  await screen.findByText("Ada");

  expect(
    (await screen.findByText(/^Couldn't load tags/)).getAttribute("role"),
  ).toBe("alert");
});

it("offers no tag filter when there are no tags", async () => {
  api.tags = [];
  renderPage();
  await screen.findByText("Ada");
  const popup = await openFilters();
  expect(within(popup).queryByRole("group", { name: "Tag" })).toBeNull();
});

it("searches by name, email, and phone digits", async () => {
  renderPage();
  await screen.findByText("Ada");

  search("ada");
  expect(shownNames()).toEqual(["Ada"]);
  search("example.org");
  expect(shownNames()).toEqual(["Lee"]);
  search("555 0102000");
  expect(shownNames()).toEqual(["Sam"]);
});

it("keeps the search, filters and view in the URL", async () => {
  renderPage();
  await screen.findByText("Ada");

  search("e");
  await check("Role", /Staff/);
  await check("Tag", /Volunteers/);
  await check("Contract", /Suspended/);
  await check("Actions", /Not caught up/);
  fireEvent.click(screen.getByRole("radio", { name: "List" }));

  expect(Object.fromEntries(new URLSearchParams(api.location))).toEqual({
    q: "e",
    role: "staff",
    tag: "t1",
    contract: "signed,suspended",
    progress: "caught-up",
  });
});

it("applies the search and filters a link carries", async () => {
  renderPage("?view=grid&q=e&role=staff&contract=signed,not-signed");
  await screen.findByText("Sam");

  expect(shownNames()).toEqual(["Sam", "Lee"]);
  expect(chips()).toEqual(["Role: Staff", "Contract: Signed, Not signed"]);
});

it("clears every filter back to the signed-only default, keeping the view", async () => {
  renderPage("?view=grid&q=e&role=staff&contract=signed,not-signed");
  await screen.findByText("Sam");

  fireEvent.click(screen.getByRole("button", { name: "Clear all" }));

  await waitFor(() => expect(chips()).toEqual(["Contract: Signed"]));
  expect(Object.fromEntries(new URLSearchParams(api.location))).toEqual({
    view: "grid",
  });
  expect(screen.queryByRole("button", { name: "Clear all" })).toBeNull();
});

it.each([
  ["caught-up", "Caught up", ["Sam"]],
  ["not-caught-up", "Not caught up", ["Ada", "Lee"]],
])("filters by whether members are %s", async (progress, chip, shown) => {
  renderPage(`?view=grid&progress=${progress}`);

  await waitFor(() => expect(shownNames()).toEqual(shown));
  expect(chips()).toEqual(["Contract: Signed", `Actions: ${chip}`]);
});

it("waits for action progress before filtering a link by it", async () => {
  let release = () => {};
  api.relationsGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  renderPage("?view=grid&progress=caught-up");
  await screen.findByText("Loading members…");
  await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
  expect(screen.getByText("Loading members…")).toBeTruthy();

  release();
  await waitFor(() => expect(shownNames()).toEqual(["Sam"]));
});

it("ignores a linked progress filter, saying so and keeping it clearable, when action progress fails to load", async () => {
  api.relationsStatus = 500;
  renderPage("?view=grid&progress=caught-up");

  expect(
    (await screen.findByText(/^Couldn't load action progress/)).getAttribute(
      "role",
    ),
  ).toBe("alert");
  expect(await screen.findByText("Ada")).toBeTruthy();
  expect(shownNames()).toEqual(["Ada", "Sam", "Lee"]);
  expect(chips()).toEqual(["Contract: Signed", "Actions: Caught up"]);

  fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
  await waitFor(() =>
    expect(new URLSearchParams(api.location).get("progress")).toBeNull(),
  );
});
