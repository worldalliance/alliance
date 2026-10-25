import { MEMBER_ACTION_DEADLINE_PASSED } from "@alliance/common/actionActivity";
import * as actionsListPageModule from "@alliance/shared/lib/actionsListPage";
import { dismissActionErrorMessage } from "@alliance/shared/lib/actionsListPage";
import type { ActionWithAwayStatus } from "@alliance/shared/lib/actionUtils";
import {
  makeAction,
  makeEvent,
  makeViewer,
} from "@alliance/shared/lib/testFixtures";
import * as globalFeedModule from "@alliance/shared/lib/useGlobalFeed";
import * as aggregateViewsModule from "@alliance/shared/lib/useTaskFormAggregateViews";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { addDays } from "date-fns";
import { MemoryRouter } from "react-router";
import * as followUpFormPanelModule from "../../components/FollowUpFormPanel";
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
import * as taskNavigatorRowModule from "./TaskNavigatorRow";

let actions: ActionWithAwayStatus[] | null = [];
let generalUpdatesFailure: LoadFailure | null = null;
let actionsFailure: LoadFailure | null = null;
let handleDismissAction: (actionId: number) => Promise<void> = async () => {};

beforeEach(() => {
  jest
    .spyOn(taskActionsDataModule, "useTaskActionsData")
    .mockImplementation(() => ({
      actions,
      generalUpdates: [],
      generalUpdatesFailure,
      actionsFailure,
      handleDismissAction,
      handleDismissGeneralUpdate: async () => {},
    }));
  jest.spyOn(utilsModule, "useSidFromParams").mockImplementation(() => {});
  jest
    .spyOn(globalFeedModule, "default")
    .mockReturnValue({ items: [], loading: false, error: null });
  jest.spyOn(homeFeedModule, "default").mockImplementation(() => <div />);
  jest.spyOn(homeUpdatesRowModule, "default").mockImplementation(() => <div />);
  jest
    .spyOn(largeActionCardModule, "default")
    .mockImplementation(() => <div />);
  jest
    .spyOn(aggregateViewsModule, "useTaskFormsAggregateViews")
    .mockReturnValue({});
});

afterEach(() => {
  actions = [];
  generalUpdatesFailure = null;
  actionsFailure = null;
  handleDismissAction = async () => {};
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

describe("HomePage dismissal refusal", () => {
  it("says the dismissal failed when the server refuses it", async () => {
    actions = [
      makeAction({ id: 7, optional: true, events: deadlineInDays(3) }),
    ];
    handleDismissAction = () =>
      Promise.reject({ statusCode: 500, message: "Internal server error" });
    jest
      .spyOn(largeActionCardModule, "default")
      .mockImplementation(({ dismissProps }) => (
        <button onClick={dismissProps?.onDismiss}>Dismiss</button>
      ));

    renderHomePage();
    fireEvent.click(screen.getByText("Dismiss"));

    await screen.findByText(dismissActionErrorMessage(undefined));
  });
});

describe("HomePage task progress", () => {
  it("shows the progress of an open task form, linked to its task", async () => {
    actions = [makeAction({ id: 8, name: "Petition", taskFormId: 70 })];
    jest
      .spyOn(aggregateViewsModule, "useTaskFormsAggregateViews")
      .mockReturnValue({
        70: [
          {
            kind: "progressbar",
            id: "signatures",
            title: "Signatures gathered",
            caption: "",
            numerator: { type: "number", value: 1 },
            denominator: { type: "number", value: 2 },
            displayType: "number",
          },
        ],
      });

    renderHomePage();

    const title = await screen.findByText("Signatures gathered");
    expect(title.closest("a")?.getAttribute("href")).toBe("/actions/8");
  });
});

describe("HomePage task selection", () => {
  it("opens the task the member picks from the list", () => {
    actions = [
      makeAction({ id: 9, name: "First task", events: deadlineInDays(3) }),
      makeAction({ id: 10, name: "Second task", events: deadlineInDays(4) }),
    ];
    jest
      .spyOn(largeActionCardModule, "default")
      .mockImplementation(({ action }) => <p>Open: {action.name}</p>);

    renderHomePage();
    screen.getByText("Open: First task");
    fireEvent.click(screen.getByText("Second task"));

    screen.getByText("Open: Second task");
  });

  it("opens the follow-up form the member picks under a completed task", () => {
    const followUpForm = (id: number, startDate: string) => ({
      id,
      name: `Follow-up ${id}`,
      startDate,
      endDate: null,
      instructions: null,
      actionId: 11,
      formId: 100 + id,
    });
    actions = [
      makeAction({
        id: 11,
        viewer: makeViewer({ relation: "completed" }),
        followUpForms: [
          followUpForm(31, "2020-01-02T00:00:00.000Z"),
          followUpForm(32, "2020-01-01T00:00:00.000Z"),
        ],
      }),
    ];
    jest
      .spyOn(taskNavigatorRowModule, "TaskNavigatorCompletedRow")
      .mockImplementation(({ followUpForms, onSelectFollowUp }) => (
        <>
          {followUpForms.map((form) => (
            <button key={form.id} onClick={() => onSelectFollowUp(form.id)}>
              {form.name}
            </button>
          ))}
        </>
      ));
    jest
      .spyOn(followUpFormPanelModule, "default")
      .mockImplementation(({ followUpForm }) => (
        <p>Open: {followUpForm.name}</p>
      ));

    renderHomePage();
    screen.getByText("Open: Follow-up 31");
    fireEvent.click(screen.getByText("Follow-up 32"));

    screen.getByText("Open: Follow-up 32");
  });
});
