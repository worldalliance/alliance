import { AnalyticsEvent } from "@alliance/common/analytics";
import * as analyticsModule from "@alliance/shared/lib/analytics";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AuthContext, type AuthContextType } from "../lib/AuthContext";
import { testAuthUser } from "../stories/testData";
import { authValue } from "../testing/authValue";
import { InviteSessionProvider } from "./invite/InviteSession";
import {
  MissingRecordPage,
  NOT_FOUND_TITLE,
  NotFoundPage,
  NotFoundSource,
} from "./NotFoundPage";

const renderPage = (
  auth: AuthContextType,
  page = <NotFoundPage source={NotFoundSource.UnmatchedRoute} />,
) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={["/no/such/page?token=secret"]}>
          <InviteSessionProvider>{page}</InviteSessionProvider>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );

const body = () => screen.getByRole("heading", { level: 1 }).parentElement!;

test("leads a logged-out visitor home alone", () => {
  renderPage(authValue());

  screen.getByRole("heading", { level: 1, name: "We couldn’t find that page" });
  const links = within(body())
    .getAllByRole("link")
    .map((link) => [link.textContent, link.getAttribute("href")]);
  expect(links).toEqual([["Learn about the Alliance", "/"]]);
  expect(document.body.textContent).not.toContain("404");
});

test("points a logged-in user to their tasks alone", () => {
  renderPage(authValue({ user: testAuthUser }));

  const links = within(body()).getAllByRole("link");
  expect(
    links.map((link) => [link.textContent, link.getAttribute("href")]),
  ).toEqual([["My tasks", "/tasks"]]);
  expect(within(body()).queryByRole("img")).toBeNull();
});

test("hides the links until auth resolves", () => {
  renderPage(authValue({ loading: true }));

  screen.getByRole("heading", { level: 1 });
  expect(within(body()).queryAllByRole("link")).toEqual([]);
});

test("records the path and source, without the query string", () => {
  const captureEvent = jest.spyOn(analyticsModule, "captureEvent");

  renderPage(authValue());

  expect(captureEvent).toHaveBeenCalledTimes(1);
  expect(captureEvent).toHaveBeenCalledWith(AnalyticsEvent.NotFound, {
    path: "/no/such/page",
    source: NotFoundSource.UnmatchedRoute,
  });
});

test("a missing record titles the tab and records its source", () => {
  const captureEvent = jest.spyOn(analyticsModule, "captureEvent");
  document.title = "Alliance";

  const { unmount } = renderPage(authValue(), <MissingRecordPage />);

  expect(document.title).toBe(NOT_FOUND_TITLE);
  expect(captureEvent).toHaveBeenCalledWith(AnalyticsEvent.NotFound, {
    path: "/no/such/page",
    source: NotFoundSource.MissingRecord,
  });
  unmount();
  expect(document.title).toBe("Alliance");
});
