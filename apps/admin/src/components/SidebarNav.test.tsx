import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import SidebarNav from "./SidebarNav";

beforeEach(() => window.localStorage.clear());

it("reads a count after the label, on a link and on a collapsed folder", () => {
  render(
    <MemoryRouter>
      <SidebarNav
        groupAssignmentCount={12}
        needsReplyCount={0}
        pendingOutreachPartnershipCount={3}
      />
    </MemoryRouter>,
  );

  expect(screen.getByRole("link", { name: "Groups (12)" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Outreach (3)" })).toBeTruthy();
});

const renderNav = (needsReplyCount: number | null) =>
  render(
    <MemoryRouter>
      <SidebarNav
        groupAssignmentCount={0}
        needsReplyCount={needsReplyCount}
        pendingOutreachPartnershipCount={0}
      />
    </MemoryRouter>,
  );

it("shows how many members need a reply on the Needs reply link", () => {
  renderNav(3);

  expect(screen.getByRole("link", { name: "Needs reply (3)" })).toBeTruthy();
});

it("marks the Needs reply link when its count couldn't load", () => {
  renderNav(null);

  expect(
    screen.getByRole("link", { name: "Needs reply (count couldn't load)" }),
  ).toBeTruthy();
});

it("caps a count past 99, on a link and on a collapsed folder", () => {
  render(
    <MemoryRouter>
      <SidebarNav
        groupAssignmentCount={140}
        needsReplyCount={0}
        pendingOutreachPartnershipCount={250}
      />
    </MemoryRouter>,
  );

  expect(screen.getByRole("link", { name: "Groups (99+)" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Outreach (99+)" })).toBeTruthy();
});
