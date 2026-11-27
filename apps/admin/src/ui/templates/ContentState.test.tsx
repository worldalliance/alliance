import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, jest } from "bun:test";
import { ContentState } from "./States";

afterEach(cleanup);

describe("ContentState from queries", () => {
  const load = (over: Record<string, unknown> = {}) => ({
    isPending: false,
    isLoadingError: false,
    isRefetchError: false,
    isFetching: false,
    error: new Error("x"),
    refetch: jest.fn(),
    ...over,
  });
  const states = (queries: Record<string, ReturnType<typeof load>>) =>
    render(
      <ContentState
        skeleton={<p>skeleton</p>}
        parts={Object.entries(queries).map(([things, query]) => ({
          things,
          query,
        }))}
      >
        content
      </ContentState>,
    );

  it("shows the skeleton while any query is on its first load", () => {
    states({ groups: load(), members: load({ isPending: true }) });
    expect(screen.getByText("skeleton")).toBeTruthy();
    expect(screen.queryByText("content")).toBeNull();
  });

  it("fails the load for the failed parts only, and retries those", () => {
    const groups = load({ isLoadingError: true });
    const members = load();
    states({ groups, members });
    expect(screen.getByRole("alert").textContent).toContain(
      "Couldn't load groups",
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect([groups, members].map((q) => q.refetch.mock.calls.length)).toEqual([
      1, 0,
    ]);
  });

  it("keeps the content under a refetch banner when a refetch failed", () => {
    states({ groups: load({ isRefetchError: true }) });
    expect(screen.getByText("content")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain(
      "Couldn't refresh groups.",
    );
  });

  it("leaves the banner to the page when refreshBanner is false", () => {
    render(
      <ContentState
        skeleton={null}
        things="groups"
        query={load({ isRefetchError: true })}
        refreshBanner={false}
      >
        content
      </ContentState>,
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
