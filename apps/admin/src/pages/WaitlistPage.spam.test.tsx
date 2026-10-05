import { fireEvent, screen, waitFor } from "@testing-library/react";
import { api, renderPage, serveWaitlistApi } from "./WaitlistPage.testHarness";

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

it("greys a spam-like row and toggles each row's spam status", async () => {
  renderPage();
  const suspected = await screen.findByRole("button", {
    name: "Mark as not spam: Person 2",
  });
  expect(suspected.closest("tr")?.className).toContain("opacity-50");
  expect(
    screen.getByRole("button", { name: "Mark as spam: Person 1" }).closest("tr")
      ?.className,
  ).not.toContain("opacity-50");

  fireEvent.click(suspected);
  fireEvent.click(
    screen.getByRole("button", { name: "Mark as spam: Person 1" }),
  );
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

it("marks the selected entries as spam after confirming", async () => {
  renderPage();
  fireEvent.click(await screen.findByLabelText("Select Person 1"));
  fireEvent.click(screen.getByRole("button", { name: "Mark as spam" }));
  expect(await screen.findByText(/get no more email/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
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
  fireEvent.click(screen.getByRole("button", { name: "Mark as not spam" }));
  expect(
    await screen.findByText(/confirmation email they missed is not sent/),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
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
  expect(screen.getByText("2 entries are selected")).toBeTruthy();
  fireEvent.click(
    screen.getByRole("button", { name: "Mark as spam: Person 1" }),
  );
  expect(await screen.findByText("1 entry is selected")).toBeTruthy();
});
