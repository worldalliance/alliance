import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { ActionPriority } from "../content/featuredImpactActions";
import { ImpactCard, ProgressLinkCard } from "./PageCards";

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

test("ImpactCard maps a featured action onto the progress card", () => {
  render(
    <MemoryRouter>
      <ImpactCard
        action={{
          actionId: 1,
          emphasis: "We collected trash",
          rest: "around our communities.",
          tags,
          customLink: "https://example.com/report",
          imageSrc: "/photo.webp",
          imageAlt: "Collected trash",
        }}
      />
    </MemoryRouter>,
  );

  const link = screen.getByRole("link", { name: /We collected trash/ });
  expect(link.getAttribute("href")).toBe("https://example.com/report");
  expect(link.querySelector("svg")).not.toBeNull();
  expect(
    screen.getByRole("img", { name: "Collected trash" }).getAttribute("src"),
  ).toBe("/photo.webp");

  const tag = screen.getByText("Environment");
  const title = screen.getByText("We collected trash");
  expect(
    tag.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).not.toBe(0);
});
