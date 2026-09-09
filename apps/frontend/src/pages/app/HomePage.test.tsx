import type { ActionWithAwayStatus } from "@alliance/shared/lib/actionUtils";
import {
  makeAction,
  makeEvent,
  makeViewer,
} from "@alliance/shared/lib/testFixtures";
import * as globalFeedModule from "@alliance/shared/lib/useGlobalFeed";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { addDays } from "date-fns";
import { MemoryRouter } from "react-router";
import * as homeFeedModule from "../../components/HomeFeed";
import * as homeUpdatesRowModule from "../../components/HomeUpdatesRow";
import { AuthContext } from "../../lib/AuthContext";
import * as taskActionsDataModule from "../../lib/useTaskActionsData";
import * as utilsModule from "../../lib/utils";
import { testAuthUser } from "../../stories/testData";
import { authValue } from "../../testing/authValue";
import HomePage from "./HomePage";
import * as largeActionCardModule from "./LargeActionCard";

let actions: ActionWithAwayStatus[] = [];

beforeEach(() => {
  jest
    .spyOn(taskActionsDataModule, "useTaskActionsData")
    .mockImplementation(() => ({
      actions,
      generalUpdates: [],
      loading: false,
      handleDismissAction: async () => {},
      handleDismissGeneralUpdate: async () => {},
    }));
  jest.spyOn(utilsModule, "useCIDFromParams").mockImplementation(() => {});
  jest
    .spyOn(globalFeedModule, "default")
    .mockReturnValue({ items: [], loading: false, error: null });
  jest.spyOn(homeFeedModule, "default").mockImplementation(() => <div />);
  jest.spyOn(homeUpdatesRowModule, "default").mockImplementation(() => <div />);
  jest
    .spyOn(largeActionCardModule, "default")
    .mockImplementation(() => <div />);
});

afterEach(cleanup);

const deadlineInDays = (days: number) => [
  makeEvent({
    newStatus: "office_action",
    date: addDays(new Date(), days).toISOString(),
  }),
];

const renderHomePage = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <AuthContext.Provider
          value={authValue({
            user: { ...testAuthUser, hasActiveContract: true },
          })}
        >
          <HomePage />
        </AuthContext.Provider>
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
