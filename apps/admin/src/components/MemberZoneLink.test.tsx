import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { getSiteUrl } from "../lib/config";
import MemberZoneLink from "./MemberZoneLink";

test("links to the member zone's counterpart of the current admin page", () => {
  render(
    <MemoryRouter initialEntries={["/posts/4"]}>
      <MemberZoneLink />
    </MemoryRouter>,
  );

  expect(
    screen
      .getByRole("link", { name: "Open in member zone" })
      .getAttribute("href"),
  ).toBe(`${getSiteUrl()}/forum/post/4`);
});

test("names its destination in a tooltip", () => {
  render(
    <MemoryRouter>
      <MemberZoneLink />
    </MemoryRouter>,
  );

  expect(screen.getByRole("link").getAttribute("title")).toBe(
    "Open in member zone",
  );
});
