import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import SidebarNav from "./SidebarNav";

const renderNav = (params: {
  groupAssignmentCount?: number;
  needsReplyCount?: number | null;
  pendingOutreachPartnershipCount?: number;
  path?: string;
}) =>
  render(
    <MemoryRouter initialEntries={[params.path ?? "/"]}>
      <SidebarNav
        groupAssignmentCount={params.groupAssignmentCount ?? 0}
        needsReplyCount={
          params.needsReplyCount === undefined ? 0 : params.needsReplyCount
        }
        pendingOutreachPartnershipCount={
          params.pendingOutreachPartnershipCount ?? 0
        }
      />
    </MemoryRouter>,
  );

it("shows every section open, labelling its links without a heading", () => {
  renderNav({});

  for (const section of ["Work", "People", "Growth", "Content", "Insights"]) {
    expect(screen.getByRole("group", { name: section })).toBeTruthy();
    expect(screen.getByText(section)).toBeTruthy();
  }
  expect(screen.queryAllByRole("heading")).toHaveLength(0);
  expect(screen.getByRole("link", { name: "Friend graph" })).toBeTruthy();
});

it("reads a count after the label", () => {
  renderNav({ groupAssignmentCount: 12, pendingOutreachPartnershipCount: 3 });

  expect(screen.getByRole("link", { name: "Groups (12)" })).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "Outreach partnerships (3)" }),
  ).toBeTruthy();
});

it("shows how many members need a reply on the Needs reply link", () => {
  renderNav({ needsReplyCount: 3 });

  expect(screen.getByRole("link", { name: "Needs reply (3)" })).toBeTruthy();
});

it("marks the Needs reply link when its count couldn't load", () => {
  renderNav({ needsReplyCount: null });

  expect(
    screen.getByRole("link", { name: "Needs reply (count couldn't load)" }),
  ).toBeTruthy();
});

it("caps a count past 99", () => {
  renderNav({ groupAssignmentCount: 140 });

  expect(screen.getByRole("link", { name: "Groups (99+)" })).toBeTruthy();
});

it("marks the current page, including its sub-pages", () => {
  renderNav({ path: "/actions/12" });

  expect(
    screen.getByRole("link", { name: "Actions" }).getAttribute("aria-current"),
  ).toBe("page");
  expect(
    screen.getByRole("link", { name: "Stats" }).getAttribute("aria-current"),
  ).toBeNull();
});

it("keeps red for a count that couldn't load, not for a count", () => {
  renderNav({ needsReplyCount: null, groupAssignmentCount: 2 });

  expect(screen.getByText("!").className).toContain("bg-red-600");
  expect(screen.getByText("2").className).not.toContain("red");
});

it("lists a section's less-used pages in its More dropdown", async () => {
  renderNav({});

  expect(screen.queryByRole("menuitem", { name: "Custom links" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "More growth pages" }));

  const item = await screen.findByRole("menuitem", { name: "Custom links" });
  expect(item.getAttribute("href")).toBe("/custom-links");
});

it("names and marks the current More page on its dropdown", () => {
  renderNav({ path: "/invites/graph" });

  expect(
    screen.getByRole("button", {
      name: "Invite graph (more growth pages)",
    }),
  ).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "Invites" }).getAttribute("aria-current"),
  ).toBeNull();
});

it("scrolls the current page's row into view", () => {
  const scroll = jest.spyOn(Element.prototype, "scrollIntoView");
  try {
    renderNav({ path: "/invites/graph" });

    expect(scroll.mock.contexts).toEqual([
      screen.getByRole("button", { name: "Invite graph (more growth pages)" }),
    ]);
  } finally {
    scroll.mockRestore();
  }
});
