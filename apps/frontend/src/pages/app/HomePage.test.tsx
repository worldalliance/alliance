import { MEMBER_ACTION_DEADLINE_PASSED } from "@alliance/common/actionActivity";
import * as actionsListPageModule from "@alliance/shared/lib/actionsListPage";
import type { ActionWithAwayStatus } from "@alliance/shared/lib/actionUtils";
import {
  makeAction,
  makeEvent,
  makeViewer,
} from "@alliance/shared/lib/testFixtures";
import * as globalFeedModule from "@alliance/shared/lib/useGlobalFeed";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { addDays } from "date-fns";
import { MemoryRouter } from "react-router";
import * as homeFeedModule from "../../components/HomeFeed";
import * as homeUpdatesRowModule from "../../components/HomeUpdatesRow";
import { type LoadFailure } from "../../components/LoadFailed";
import { AuthContext } from "../../lib/AuthContext";
import * as taskActionsDataModule from "../../lib/useTaskActionsData";
import * as utilsModule from "../../lib/utils";
import { testAuthUser } from "../../stories/testData";
import { authValue } from "../../testing/authValue";
import HomePage from "./HomePage";
import * as largeActionCardModule from "./LargeActionCard";

let actions: ActionWithAwayStatus[] | null = [];
let generalUpdatesFailure: LoadFailure | null = null;
let actionsFailure: LoadFailure | null = null;

beforeEach(() => {
  jest
    .spyOn(taskActionsDataModule, "useTaskActionsData")
    .mockImplementation(() => ({
      actions,
      generalUpdates: [],
      generalUpdatesFailure,
      actionsFailure,
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

afterEach(() => {
  actions = [];
  generalUpdatesFailure = null;
  actionsFailure = null;
  cleanup();
});

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
          <ToastProvider>
            <HomePage />
          </ToastProvider>
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

describe("HomePage general updates", () => {
  it("offers a retry when general updates fail to load", () => {
    const retry = jest.fn();
    generalUpdatesFailure = { onRetry: retry, retrying: false };

    renderHomePage();
    fireEvent.click(screen.getByText("Try again"));

    screen.getByText("Couldn't load general updates.");
    expect(retry).toHaveBeenCalledTimes(1);
  });
});

describe("HomePage task list failure", () => {
  it("offers a retry when the task list fails to load", () => {
    const retry = jest.fn();
    actions = null;
    actionsFailure = { onRetry: retry, retrying: false };

    renderHomePage();
    fireEvent.click(screen.getByText("Try again"));

    screen.getByText("Couldn't load your tasks.");
    expect(retry).toHaveBeenCalledTimes(1);
  });
});

describe("HomePage deadline refusal", () => {
  it("toasts the deadline message under the task's name and reloads without scrolling to the top", () => {
    actions = [
      makeAction({ id: 6, name: "Late task", events: deadlineInDays(3) }),
    ];
    jest
      .spyOn(largeActionCardModule, "default")
      .mockImplementation(({ onDeadlinePassed }) => (
        <button onClick={onDeadlinePassed}>Submit late</button>
      ));
    const invalidateActions = jest.fn();
    jest
      .spyOn(actionsListPageModule, "useInvalidateActions")
      .mockReturnValue(invalidateActions);
    const scrollTo = jest.spyOn(window, "scrollTo").mockImplementation();

    renderHomePage();
    fireEvent.click(screen.getByText("Submit late"));

    screen.getByText(MEMBER_ACTION_DEADLINE_PASSED);
    screen.getByRole("heading", { name: "Late task" });
    expect(invalidateActions).toHaveBeenCalledTimes(1);
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
