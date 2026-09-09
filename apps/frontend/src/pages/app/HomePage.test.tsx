import type { ActionWithAwayStatus } from "@alliance/shared/lib/actionUtils";
import {
  makeAction,
  makeEvent,
  makeViewer,
} from "@alliance/shared/lib/testFixtures";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

let actions: ActionWithAwayStatus[] = [];

jest.mock("../../lib/useTaskActionsData", () => ({
  useTaskActionsData: () => ({
    actions,
    generalUpdates: [],
    loading: false,
    handleDismissAction: async () => {},
    handleDismissGeneralUpdate: async () => {},
  }),
}));
jest.mock("../../lib/AuthContext", () => ({
  useAuth: () => ({ user: { hasActiveContract: true }, refreshUser: () => {} }),
}));
jest.mock("../../lib/utils", () => ({ useCIDFromParams: () => {} }));
jest.mock("../../lib/useMediaQuery", () => ({ useMediaQuery: () => false }));
jest.mock("@alliance/shared/lib/useGlobalFeed", () => ({
  __esModule: true,
  default: () => ({ items: [], loading: false }),
}));
jest.mock("../../components/HomeFeed", () => ({
  __esModule: true,
  default: () => <div />,
}));
jest.mock("../../components/HomeUpdatesRow", () => ({
  __esModule: true,
  default: () => <div />,
}));
jest.mock("./LargeActionCard", () => ({
  __esModule: true,
  default: () => <div />,
}));

import HomePage from "./HomePage";

afterEach(cleanup);

const deadlineInDays = (days: number) => [
  makeEvent({
    newStatus: "office_action",
    date: new Date(Date.now() + days * 86_400_000).toISOString(),
  }),
];

const renderHomePage = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("HomePage task list", () => {
  it("lists the upcoming tasks when every task sits past the current week", () => {
    actions = [
      makeAction({ id: 1, name: "Far task", events: deadlineInDays(21) }),
    ];

    renderHomePage();

    expect(screen.queryByText("Upcoming")).not.toBeNull();
    expect(screen.queryByText("Far task")).not.toBeNull();
  });

  it("lists the upcoming tasks when an away task holds the week at 7 days", () => {
    actions = [
      makeAction({
        id: 2,
        name: "Away task",
        awayStatus: "away_currently",
        viewer: makeViewer({ away: "away_currently" }),
        events: deadlineInDays(3),
      }),
      makeAction({ id: 3, name: "Visible task", events: deadlineInDays(10) }),
    ];

    renderHomePage();

    expect(screen.queryByText("Upcoming")).not.toBeNull();
    expect(screen.queryByText("Visible task")).not.toBeNull();
  });
});

describe("HomePage current-week summary", () => {
  it("counts every current-week task but only the required minutes", () => {
    actions = [
      makeAction({
        id: 4,
        name: "Required task",
        timeEstimate: 10,
        events: deadlineInDays(3),
      }),
      makeAction({
        id: 5,
        name: "Optional task",
        optional: true,
        timeEstimate: 40,
        events: deadlineInDays(3),
      }),
    ];

    renderHomePage();

    expect(screen.getByText(/left/).closest("p")?.textContent).toBe(
      "2 left (10 minutes required)",
    );
  });
});
