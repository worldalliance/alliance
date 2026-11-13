import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import SidebarNav from "./SidebarNav";

beforeEach(() => window.localStorage.clear());

it("reads a count after the label, on a link and on a collapsed folder", () => {
  render(
    <MemoryRouter>
      <SidebarNav
        groupAssignmentCount={12}
        pendingOutreachPartnershipCount={3}
      />
    </MemoryRouter>,
  );

  expect(screen.getByRole("link", { name: "Groups (12)" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Outreach (3)" })).toBeTruthy();
});

it("caps a count past 99, on a link and on a collapsed folder", () => {
  render(
    <MemoryRouter>
      <SidebarNav
        groupAssignmentCount={140}
        pendingOutreachPartnershipCount={250}
      />
    </MemoryRouter>,
  );

  expect(screen.getByRole("link", { name: "Groups (99+)" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Outreach (99+)" })).toBeTruthy();
});
