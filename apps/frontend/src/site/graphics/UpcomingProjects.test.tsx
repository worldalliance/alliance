import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { UPCOMING_PROJECTS } from "../content";
import { HIGHLIGHT_INTERVAL_MS, UpcomingProjects } from "./UpcomingProjects";

const highlighted = () =>
  screen
    .getAllByRole("link")
    .filter((link) => link.hasAttribute("data-highlighted"))
    .map(
      (link) =>
        UPCOMING_PROJECTS.find((project) =>
          link.textContent?.includes(project.title),
        )?.title,
    );

beforeEach(() => {
  jest.useFakeTimers();
  render(
    <MemoryRouter>
      <UpcomingProjects />
    </MemoryRouter>,
  );
});

afterEach(() => {
  jest.useRealTimers();
});

test("links each project to its page", () => {
  const links = screen.getAllByRole("link");
  expect(links.map((link) => link.getAttribute("href"))).toEqual(
    UPCOMING_PROJECTS.map((project) => project.href),
  );
});

test("shows each project's progress toward its goal", () => {
  const list = within(screen.getByRole("list", { name: "Upcoming projects" }));
  expect(list.getByText("267/1,000 members")).toBeTruthy();
  expect(list.getByText("238/500 participants")).toBeTruthy();
});

test("moves the highlight to the next project on a timer and wraps", () => {
  const [first, second] = UPCOMING_PROJECTS;
  expect(highlighted()).toEqual([first.title]);
  act(() => jest.advanceTimersByTime(HIGHLIGHT_INTERVAL_MS));
  expect(highlighted()).toEqual([second.title]);
  act(() => jest.advanceTimersByTime(HIGHLIGHT_INTERVAL_MS));
  expect(highlighted()).toEqual([first.title]);
});

test("holds the highlight on a hovered project until the pointer leaves", () => {
  const second = UPCOMING_PROJECTS[1];
  const link = screen.getByRole("link", {
    name: (name) => name.startsWith(second.title),
  });
  fireEvent.mouseEnter(link);
  act(() => jest.advanceTimersByTime(HIGHLIGHT_INTERVAL_MS * 3));
  expect(highlighted()).toEqual([second.title]);

  fireEvent.mouseLeave(link);
  act(() => jest.advanceTimersByTime(HIGHLIGHT_INTERVAL_MS));
  expect(highlighted()).toEqual([UPCOMING_PROJECTS[0].title]);
});
