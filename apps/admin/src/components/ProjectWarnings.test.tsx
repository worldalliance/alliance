import { fireEvent, render, screen } from "@testing-library/react";
import { ProjectFlagKind, type ProjectFlag } from "../lib/projectCards";
import ProjectWarnings from "./ProjectWarnings";

const flag = (id: number, name: string): ProjectFlag => ({
  kind: ProjectFlagKind.GapBeforeNextStep,
  step: { id, name },
  at: new Date(),
});

it("shows a lone warning in full", () => {
  render(<ProjectWarnings flags={[flag(1, "Rally")]} />);
  expect(screen.getByText('Nothing planned after "Rally"')).toBeTruthy();
  expect(screen.queryByRole("button")).toBeNull();
});

it("collapses several warnings into a count that expands to list them", () => {
  render(<ProjectWarnings flags={[flag(1, "Rally"), flag(2, "Letter")]} />);
  const toggle = screen.getByRole("button", { name: "2 warnings" });
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(toggle.hasAttribute("aria-controls")).toBe(false);
  expect(screen.queryByRole("listitem")).toBeNull();

  fireEvent.click(toggle);

  expect(screen.getByRole("list").id).toBe(
    toggle.getAttribute("aria-controls"),
  );
  expect(
    screen.getAllByRole("listitem").map((item) => item.textContent),
  ).toEqual([
    'Nothing planned after "Rally"',
    'Nothing planned after "Letter"',
  ]);
});

it("renders nothing without warnings", () => {
  const { container } = render(<ProjectWarnings flags={[]} />);
  expect(container.textContent).toBe("");
});

it("can start with the warnings listed", () => {
  render(
    <ProjectWarnings
      flags={[flag(1, "Rally"), flag(2, "Letter")]}
      defaultOpen
    />,
  );
  expect(screen.getAllByRole("listitem")).toHaveLength(2);
});
