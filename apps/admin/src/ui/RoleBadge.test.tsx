import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "bun:test";
import { MemberRole, RoleBadge } from "./RoleBadge";

afterEach(cleanup);

it("shows the frontend's role words and tooltip", () => {
  render(<RoleBadge role={MemberRole.GroupLead} />);
  expect(screen.getByText("Lead").getAttribute("title")).toBe(
    "Leads a group of members",
  );
});
