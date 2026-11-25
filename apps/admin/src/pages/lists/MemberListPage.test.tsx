import { fireEvent, screen, waitFor } from "@testing-library/react";
import {
  api,
  renderPage,
  serveMemberListPageApi,
  volunteers,
} from "./memberListPageTesting";

serveMemberListPageApi();

test("creates a list from pasted ids and emails, listing what didn't match", async () => {
  api.lists = [];
  const router = renderPage("/members/lists/new");
  await screen.findByRole("heading", { name: "New member list" });
  fireEvent.change(screen.getByLabelText(/^Name/), {
    target: { value: "Volunteers" },
  });
  fireEvent.change(screen.getByLabelText(/^Add by id or email/), {
    target: { value: "7, BO@example.com\nnobody@example.com" },
  });
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Add members" }).ariaDisabled,
    ).not.toBe("true"),
  );
  fireEvent.click(screen.getByRole("button", { name: "Add members" }));
  expect(
    await screen.findByText(
      "This matched no member, so it wasn't added: nobody@example.com",
    ),
  ).toBeTruthy();
  // The unmatched entry stays in the box to correct.
  expect(screen.getByLabelText(/^Add by id or email/)).toHaveProperty(
    "value",
    "nobody@example.com",
  );
  expect(screen.getByText("Members (2)")).toBeTruthy();
  // An entry still unmatched stops the save.
  fireEvent.click(screen.getByRole("button", { name: "Create member list" }));
  await screen.findByText(
    "This matched no member, so it wasn't added: nobody@example.com",
  );
  expect(api.listSaves).toEqual([]);
  fireEvent.change(screen.getByLabelText(/^Add by id or email/), {
    target: { value: "" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create member list" }));
  await waitFor(() =>
    expect(router.state.location.pathname).toBe(
      `/members/lists/${volunteers.id}`,
    ),
  );
  expect(api.listSaves).toEqual([{ name: "Volunteers", userIds: [7, 12] }]);
});

test("saves an edit against the version it opened, and offers Reload on a conflict", async () => {
  api.updateStatus = 409;
  renderPage(`/members/lists/${volunteers.id}`);
  await screen.findByRole("heading", { name: "Volunteers" });
  fireEvent.change(screen.getByLabelText(/^Name/), {
    target: { value: "Helpers" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(
    await screen.findByText(
      "This list changed since you opened it. Reload to see the changes.",
    ),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "Reload" })).toBeTruthy();
  expect(api.listSaves).toEqual([
    { name: "Helpers", userIds: [7], baseVersionId: 5, baseName: "Volunteers" },
  ]);
});

test("saves entries left in the paste box without Add members", async () => {
  renderPage(`/members/lists/${volunteers.id}`);
  await screen.findByRole("heading", { name: "Volunteers" });
  fireEvent.change(screen.getByLabelText(/^Add by id or email/), {
    target: { value: "12" },
  });
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Add members" }).ariaDisabled,
    ).not.toBe("true"),
  );
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await screen.findByText("Member list saved");
  expect(api.listSaves).toEqual([
    {
      name: "Volunteers",
      userIds: [7, 12],
      baseVersionId: 5,
      baseName: "Volunteers",
    },
  ]);
  expect(screen.getByText("Members (2)")).toBeTruthy();
});

test("clears the members-loading alert once a later save matches the paste", async () => {
  const { promise, resolve } = Promise.withResolvers<void>();
  api.usersHeld = promise;
  renderPage(`/members/lists/${volunteers.id}`);
  await screen.findByRole("heading", { name: "Volunteers" });
  fireEvent.change(screen.getByLabelText(/^Add by id or email/), {
    target: { value: "12" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await screen.findByText(/^Members are still loading/);
  expect(api.listSaves).toEqual([]);
  resolve();
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Add members" }).ariaDisabled,
    ).not.toBe("true"),
  );
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await screen.findByText("Member list saved");
  expect(screen.getByText("Members (2)")).toBeTruthy();
  expect(screen.queryByText(/^Members are still loading/)).toBeNull();
});

test("keeps the members' picks shown but locked while a save is in flight", async () => {
  const { promise, resolve } = Promise.withResolvers<void>();
  api.updateHeld = promise;
  renderPage(`/members/lists/${volunteers.id}`);
  await screen.findByRole("heading", { name: "Volunteers" });
  fireEvent.change(screen.getByLabelText(/^Name/), {
    target: { value: "Helpers" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await screen.findByText("Saving…");
  expect(
    screen.getByRole("button", { name: "Remove Ana" }).hasAttribute("disabled"),
  ).toBe(true);
  resolve();
  await screen.findByText("Member list saved");
  expect(
    screen.getByRole("heading", { name: "Helpers", level: 1 }),
  ).toBeTruthy();
  expect(screen.getByText("Members (1)")).toBeTruthy();
});

test("clears the unmatched entries alert once the paste box is emptied", async () => {
  renderPage(`/members/lists/${volunteers.id}`);
  await screen.findByRole("heading", { name: "Volunteers" });
  const box = screen.getByLabelText(/^Add by id or email/);
  fireEvent.change(box, { target: { value: "nobody@example.com" } });
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Add members" }).ariaDisabled,
    ).not.toBe("true"),
  );
  fireEvent.click(screen.getByRole("button", { name: "Add members" }));
  await screen.findByText(/matched no member/);
  fireEvent.change(box, { target: { value: "" } });
  expect(screen.queryByText(/matched no member/)).toBeNull();
});

test("refuses to save pasted entries when members couldn't load", async () => {
  api.usersStatus = 500;
  renderPage(`/members/lists/${volunteers.id}`);
  await screen.findByRole("heading", { name: "Volunteers" });
  fireEvent.change(screen.getByLabelText(/^Add by id or email/), {
    target: { value: "12" },
  });
  await screen.findByText("Failed to load users.");
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(
    await screen.findByText(
      "Members couldn't load, so the pasted entries can't be matched. Reload the page to try again.",
    ),
  ).toBeTruthy();
  expect(api.listSaves).toEqual([]);
});

test("refuses a blank name and focuses the name field", async () => {
  renderPage(`/members/lists/${volunteers.id}`);
  await screen.findByRole("heading", { name: "Volunteers" });
  const name = screen.getByLabelText(/^Name/);
  fireEvent.change(name, { target: { value: "   " } });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(await screen.findByText("Enter a name")).toBeTruthy();
  await waitFor(() => expect(document.activeElement).toBe(name));
  expect(api.listSaves).toEqual([]);
});

test("says why Add members can't match when members couldn't load", async () => {
  api.usersStatus = 500;
  renderPage(`/members/lists/${volunteers.id}`);
  await screen.findByRole("heading", { name: "Volunteers" });
  fireEvent.change(screen.getByLabelText(/^Add by id or email/), {
    target: { value: "12" },
  });
  await screen.findByText("Failed to load users.");
  fireEvent.click(screen.getByRole("button", { name: "Add members" }));
  expect(
    await screen.findByText(
      "Members couldn't load, so the pasted entries can't be matched. Reload the page to try again.",
    ),
  ).toBeTruthy();
  expect(screen.getByText("Members (1)")).toBeTruthy();
});

test("disables Delete list and the member picker while a save runs", async () => {
  const { promise, resolve } = Promise.withResolvers<void>();
  api.updateHeld = promise;
  renderPage(`/members/lists/${volunteers.id}`);
  await screen.findByRole("heading", { name: "Volunteers" });
  fireEvent.change(screen.getByLabelText(/^Name/), {
    target: { value: "Helpers" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await screen.findByText("Saving…");
  expect(
    screen
      .getByRole("button", { name: "Delete list" })
      .hasAttribute("disabled"),
  ).toBe(true);
  expect(screen.getByLabelText(/^Members/).hasAttribute("disabled")).toBe(true);
  resolve();
  await screen.findByText("Member list saved");
  expect(
    screen
      .getByRole("button", { name: "Delete list" })
      .hasAttribute("disabled"),
  ).toBe(false);
  expect(screen.getByLabelText(/^Members/).hasAttribute("disabled")).toBe(
    false,
  );
});

test("says a list that isn't there was not found", async () => {
  renderPage("/members/lists/00000000-0000-4000-8000-0000000000b2");
  expect(await screen.findByText("Member list not found")).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "All member lists" }).getAttribute("href"),
  ).toBe("/members/lists");
});

test("says an id that can't be a list's is not found", async () => {
  renderPage("/members/lists/12");
  expect(await screen.findByText("Member list not found")).toBeTruthy();
});
