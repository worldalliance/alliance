import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it } from "bun:test";
import { projectColor } from "./projectColor";
import { ProjectSwatch } from "./ProjectSwatch";

afterEach(cleanup);

it("shows the project's colour, hidden from screen readers", () => {
  const { container } = render(<ProjectSwatch projectId={12} />);
  const swatch = container.firstElementChild;
  expect(swatch?.getAttribute("aria-hidden")).toBe("true");
  expect(swatch?.className).toContain(projectColor(12).solid);
});
