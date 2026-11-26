import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "bun:test";
import { MemberRole, RoleBadge } from "./RoleBadge";

afterEach(cleanup);

it("shows the frontend's role word, with no tooltip only a pointer can reach", () => {
  render(<RoleBadge role={MemberRole.GroupLead} />);
  expect(screen.getByText("Lead").hasAttribute("title")).toBe(false);
});
