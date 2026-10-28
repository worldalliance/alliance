import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { ActionPriority } from "../content/featuredImpactActions";
import { ProgressLinkCard } from "./PageCards";

const tags = [ActionPriority.Environment] as const;

const renderCard = (to?: string) =>
  render(
    <MemoryRouter>
      <ProgressLinkCard
        title="Cafe policy"
        description="Eleven locations changed."
        tags={tags}
        to={to}
        arrow
      />
    </MemoryRouter>,
  );

test("a destination makes the card a link with a navy arrow", () => {
  renderCard("/projects/plant-based-study");

  const link = screen.getByRole("link", { name: /Cafe policy/ });
  expect(link.getAttribute("href")).toBe("/projects/plant-based-study");
  const arrow = link.querySelector("svg");
  expect(arrow?.getAttribute("class")).toContain("text-(--site-primary)");
});

test("an external destination opens in a new tab", () => {
  renderCard("https://example.com/report");

  const link = screen.getByRole("link", { name: /Cafe policy/ });
  expect(link.getAttribute("href")).toBe("https://example.com/report");
  expect(link.getAttribute("target")).toBe("_blank");
  expect(link.querySelector("svg")).not.toBeNull();
});

test("without a destination the card is not a link and has no arrow", () => {
  const { container } = renderCard();

  expect(screen.queryByRole("link")).toBeNull();
  expect(container.querySelector("svg")).toBeNull();
  screen.getByText("Cafe policy");
});
