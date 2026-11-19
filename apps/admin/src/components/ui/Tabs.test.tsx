import { render, screen, within } from "@testing-library/react";
import { expect, it } from "bun:test";
import { MemoryRouter } from "react-router";
import Tabs from "./Tabs";

it("links each tab and marks only the current one", () => {
  render(
    <MemoryRouter>
      <Tabs
        label="Action"
        items={[
          { key: "overview", label: "Overview" },
          { key: "content", label: "Content" },
        ]}
        current="content"
        href={(key) => `?tab=${key}`}
      />
    </MemoryRouter>,
  );

  const links = within(
    screen.getByRole("navigation", { name: "Action" }),
  ).getAllByRole("link");
  expect(links.map((link) => link.getAttribute("href"))).toEqual([
    "/?tab=overview",
    "/?tab=content",
  ]);
  expect(links.map((link) => link.getAttribute("aria-current"))).toEqual([
    null,
    "page",
  ]);
});
