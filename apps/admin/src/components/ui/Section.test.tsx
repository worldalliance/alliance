import { fireEvent, render, screen } from "@testing-library/react";
import Section from "./Section";

it("titles a region with its heading, description, header actions and body", () => {
  render(
    <Section
      title="Live"
      meta={3}
      description="Running now"
      actions={<button type="button">Refresh</button>}
    >
      <p>Body</p>
    </Section>,
  );

  const region = screen.getByRole("region", { name: "Live 3" });
  expect(screen.getByRole("heading").textContent).toBe("Live 3");
  expect(region.textContent).toContain("Running now");
  expect(screen.getByRole("button", { name: "Refresh" })).toBeTruthy();
  expect(screen.getByText("Body")).toBeTruthy();
});

it("hides the body of a collapsible section until its title is pressed", () => {
  render(
    <Section title="Done" collapsible={{ defaultOpen: false }}>
      <p>Body</p>
    </Section>,
  );

  const toggle = screen.getByRole("button", { name: "Done" });
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByText("Body")).toBeNull();

  fireEvent.click(toggle);

  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  expect(screen.getByText("Body")).toBeTruthy();
});
