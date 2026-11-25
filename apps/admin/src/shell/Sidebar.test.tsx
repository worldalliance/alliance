import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, mock } from "bun:test";
import { useState } from "react";
import { MemoryRouter } from "react-router";
import { getSiteUrl } from "../lib/config";
import { CountId } from "../places";
import Sidebar from "./Sidebar";
import type { QueueCount } from "./useQueueCounts";

const NO_COUNTS: Record<CountId, QueueCount> = {
  [CountId.NeedsReply]: 0,
  [CountId.WelcomeQueue]: 0,
  [CountId.AwaitingGroup]: 0,
  [CountId.PartnershipResponses]: 0,
};

const user = {
  name: "Ana Lee",
  email: "ana@example.org",
  profilePicture: null,
};

const renderSidebar = ({
  counts = {},
  at = "/",
  onOpenPalette = () => {},
  onSignOut = () => {},
}: {
  counts?: Partial<Record<CountId, QueueCount>>;
  at?: string;
  onOpenPalette?: () => void;
  onSignOut?: () => void;
} = {}) => {
  const Harness = () => {
    const [expanded, setExpanded] = useState(true);
    return (
      <Sidebar
        expanded={expanded}
        onToggle={() => setExpanded((was) => !was)}
        onOpenPalette={onOpenPalette}
        counts={{ ...NO_COUNTS, ...counts }}
        user={user}
        onSignOut={onSignOut}
      />
    );
  };
  return render(
    <MemoryRouter initialEntries={[at]}>
      <Harness />
    </MemoryRouter>,
  );
};

it("lists the fixed entries, then the queues, each a link to its place", () => {
  renderSidebar();

  const main = screen.getByRole("navigation", { name: "Main" });
  expect(
    [...main.querySelectorAll("a")].map((link) => [
      link.textContent,
      link.getAttribute("href"),
    ]),
  ).toEqual([
    ["Home", "/"],
    ["Inbox", "/inbox"],
    ["Tasks", "/tasks"],
    ["Members", "/members"],
    ["Welcome queue", "/members/welcome"],
    ["Awaiting a group", "/members/groups?tab=awaiting"],
    ["Partnership responses", "/growth/partnerships"],
  ]);
});

it("reads a queue's count after its name", () => {
  renderSidebar({
    counts: {
      [CountId.NeedsReply]: 3,
      [CountId.WelcomeQueue]: 5,
      [CountId.AwaitingGroup]: 12,
      [CountId.PartnershipResponses]: 2,
    },
  });

  expect(screen.getByRole("link", { name: "Inbox (3)" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Welcome queue (5)" })).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "Awaiting a group (12)" }),
  ).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "Partnership responses (2)" }),
  ).toBeTruthy();
});

it("shows no count at zero or while one loads", () => {
  renderSidebar({ counts: { [CountId.WelcomeQueue]: undefined } });

  expect(screen.getByRole("link", { name: "Inbox" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Welcome queue" })).toBeTruthy();
});

it("marks an entry whose count couldn't load", () => {
  renderSidebar({ counts: { [CountId.NeedsReply]: null } });

  expect(
    screen.getByRole("link", { name: "Inbox (count couldn't load)" }),
  ).toBeTruthy();
});

it("caps a count past 99", () => {
  renderSidebar({ counts: { [CountId.AwaitingGroup]: 140 } });

  expect(
    screen.getByRole("link", { name: "Awaiting a group (99+)" }),
  ).toBeTruthy();
});

it.each([
  ["/tasks/suites/4", "Tasks"],
  ["/members/7", "Members"],
  ["/members/groups", "Members"],
  ["/members/groups?tab=awaiting", "Awaiting a group"],
  ["/members/welcome", "Welcome queue"],
  ["/inbox/abc", "Inbox"],
  ["/", "Home"],
])("at %s the current entry is %s", (at, name) => {
  renderSidebar({ at });

  const current = screen
    .getAllByRole("link")
    .filter((link) => link.getAttribute("aria-current") === "page");
  expect(current.map((link) => link.textContent)).toEqual([name]);
});

it("marks no entry on a page reached only through the palette", () => {
  renderSidebar({ at: "/growth/invites" });

  expect(
    screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current")),
  ).toEqual([]);
});

it("collapses and expands from one button that says which it does", () => {
  renderSidebar();

  const collapse = screen.getByRole("button", { name: "Collapse sidebar" });
  expect(collapse.getAttribute("aria-expanded")).toBe("true");
  fireEvent.click(collapse);

  const expand = screen.getByRole("button", { name: "Expand sidebar" });
  expect(expand.getAttribute("aria-expanded")).toBe("false");
  expect(screen.getByRole("link", { name: "Inbox" })).toBeTruthy();
});

it("opens the palette from All pages and search", () => {
  const onOpenPalette = mock();
  renderSidebar({ onOpenPalette });

  fireEvent.click(screen.getByRole("button", { name: /All pages and search/ }));

  expect(onOpenPalette).toHaveBeenCalledTimes(1);
});

it("links to the member zone's counterpart of the current admin page", () => {
  renderSidebar({ at: "/content/posts/4" });

  expect(
    screen
      .getByRole("link", { name: "Open in member zone" })
      .getAttribute("href"),
  ).toBe(`${getSiteUrl()}/forum/post/4`);
});

it("offers settings and sign out under the account", async () => {
  const onSignOut = mock();
  renderSidebar({ onSignOut });

  fireEvent.click(screen.getByRole("button", { name: "Account: Ana Lee" }));
  expect(
    (await screen.findByRole("menuitem", { name: "Settings" })).getAttribute(
      "href",
    ),
  ).toBe("/settings");
  fireEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));

  expect(onSignOut).toHaveBeenCalledTimes(1);
});
