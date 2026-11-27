import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import {
  api,
  pickMenuItem,
  renderPage,
  serveWaitlistApi,
} from "./WaitlistPage.testHarness";

const MORE = "More actions on selected entries";

serveWaitlistApi();

it("starts with spam-like entries filtered out", async () => {
  renderPage();
  await screen.findByText("person1@example.com");
  expect(api.searches[0]?.filter).toEqual({
    spamStatuses: ["clean", "not_spam"],
  });
  expect(
    screen.getByRole("button", { name: /^Spam\s*·\s*Clean, Not spam/ }),
  ).toBeTruthy();
});

const row = (name: string) =>
  screen.getByLabelText(`Select ${name}`).closest("tr") ?? document.body;

it("marks a spam-like row and toggles each row's spam status", async () => {
  renderPage();
  await screen.findByText("person1@example.com");
  expect(within(row("Person 2")).getByText("Suspected spam")).toBeTruthy();
  expect(within(row("Person 1")).getByText("Clean")).toBeTruthy();

  await pickMenuItem("More: Person 2", "Mark as not spam");
  await pickMenuItem("More: Person 1", "Mark as spam");
  await waitFor(() =>
    expect(api.posts).toEqual([
      {
        path: "/waitlist/admin/entries/mark-not-spam",
        body: { entryIds: [2] },
      },
      { path: "/waitlist/admin/entries/mark-spam", body: { entryIds: [1] } },
    ]),
  );
  expect(await screen.findByText("Marked Person 2 as not spam")).toBeTruthy();
  expect(await screen.findByText("Marked Person 1 as spam")).toBeTruthy();
  await waitFor(() => expect(api.searches.length).toBeGreaterThan(1));
});

it("moves focus to the next row when a row's spam change filters it out", async () => {
  renderPage();
  await screen.findByText("person1@example.com");
  await pickMenuItem("More: Person 1", "Mark as spam");
  await screen.findByText("Marked Person 1 as spam");
  await waitFor(() =>
    expect(row("Person 2").contains(document.activeElement)).toBe(true),
  );
});

it("marks the selected entries as spam after confirming", async () => {
  renderPage();
  fireEvent.click(await screen.findByLabelText("Select Person 1"));
  await pickMenuItem(MORE, "Mark as spam");
  expect(await screen.findByText(/get no more email/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Mark spam" }));
  await waitFor(() =>
    expect(api.posts).toEqual([
      { path: "/waitlist/admin/entries/mark-spam", body: { entryIds: [1] } },
    ]),
  );
  expect(await screen.findByText("Marked 1 entry as spam")).toBeTruthy();
});

it("marks the selected entries as not spam after confirming", async () => {
  renderPage();
  fireEvent.click(await screen.findByLabelText("Select Person 2"));
  await pickMenuItem(MORE, "Mark as not spam");
  expect(
    await screen.findByText(/confirmation email they missed isn't sent/),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Mark not spam" }));
  await waitFor(() =>
    expect(api.posts).toEqual([
      {
        path: "/waitlist/admin/entries/mark-not-spam",
        body: { entryIds: [2] },
      },
    ]),
  );
  expect(await screen.findByText("Marked 1 entry as not spam")).toBeTruthy();
});

it("drops an entry from the selection once its row toggle changes it", async () => {
  renderPage();
  fireEvent.click(await screen.findByLabelText("Select Person 1"));
  fireEvent.click(screen.getByLabelText("Select Person 2"));
  expect(screen.getByText("2 selected")).toBeTruthy();
  await pickMenuItem("More: Person 1", "Mark as spam");
  expect(await screen.findByText("1 selected")).toBeTruthy();
});
