import { taskFlow, withdrawFromAction } from "@alliance/shared/lib/copy";
import { makeAction } from "@alliance/shared/lib/testFixtures";
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { useLocation } from "react-router";
import ActionTaskPanelForm from "../ActionTaskPanelForm";
import { CardMenuSlotContext } from "./CardMenuSlot";
import {
  action,
  backgroundOnlySchema,
  CLOSE_TIMEOUT,
  holdSubmit,
  navigate,
  openFirstQuestionScreen,
  renderFlow,
  serveTaskFlow,
  setServedSchema,
  setSubmitStatus,
  taskSchema,
} from "./TaskFlow.testing";

serveTaskFlow();

it("opens the project background, then one screen per page", async () => {
  renderFlow();

  fireEvent.click(await screen.findByRole("button", { name: taskFlow.begin }));

  expect(
    await screen.findByRole("heading", { name: taskFlow.background }),
  ).toBeTruthy();
  expect(screen.getByText("Why this project matters")).toBeTruthy();
  expect(screen.getByText("Sam Reviewer")).toBeTruthy();
  expect(screen.getByText("Expert")).toBeTruthy();
  expect(screen.queryByText(taskFlow.progressSaved)).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByRole("heading", { name: "Rate the chatbot" });
  expect(screen.getAllByRole("textbox")).toHaveLength(2);
  expect(screen.getByText(taskFlow.progressSaved)).toBeTruthy();
});

it("says progress is saved from the second step on", async () => {
  setServedSchema({ ...taskSchema, pages: taskSchema.pages.slice(1) });
  renderFlow();

  fireEvent.click(await screen.findByRole("button", { name: taskFlow.begin }));
  fireEvent.change(
    await screen.findByRole("textbox", { name: /First impression/ }),
    { target: { value: "Helpful" } },
  );
  expect(screen.queryByText(taskFlow.progressSaved)).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: taskFlow.next }));
  await screen.findByRole("textbox", { name: /Anything else/ });
  expect(screen.getByText(taskFlow.progressSaved)).toBeTruthy();
});

it("keeps the member on a screen until its required answers are in", async () => {
  renderFlow();
  await openFirstQuestionScreen();

  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await waitFor(() =>
    expect(screen.getByRole("textbox", { name: /First impression/ })).toBe(
      document.activeElement,
    ),
  );
  expect(screen.getAllByRole("textbox")).toHaveLength(2);

  fireEvent.change(screen.getByRole("textbox", { name: /First impression/ }), {
    target: { value: "Helpful" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await waitFor(() =>
    expect(screen.getByRole("textbox", { name: /Anything else/ })).toBeTruthy(),
  );
});

it("stays on the last screen with the error when the submit fails", async () => {
  setSubmitStatus(500);
  const onCompleteAction = jest.fn();
  renderFlow({ onCompleteAction });
  await openFirstQuestionScreen();
  fireEvent.change(screen.getByRole("textbox", { name: /First impression/ }), {
    target: { value: "Helpful" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  fireEvent.click(await screen.findByRole("button", { name: taskFlow.submit }));

  expect(await screen.findByText("Failed to submit action.")).toBeTruthy();
  expect(screen.getByRole("button", { name: taskFlow.submit })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: taskFlow.complete })).toBeNull();
  expect(onCompleteAction).not.toHaveBeenCalled();
});

it("shows why a broken form can't open in place of its screens", async () => {
  setServedSchema({
    ...backgroundOnlySchema,
    variables: [{ name: "total", inputs: {}, formula: "this" }],
  });
  renderFlow();
  fireEvent.click(await screen.findByRole("button", { name: taskFlow.begin }));

  expect(await screen.findByText("This form can't be displayed")).toBeTruthy();
  expect(
    screen.queryByRole("heading", { name: taskFlow.background }),
  ).toBeNull();
});

it("stays open while the submit is in flight", async () => {
  const release = holdSubmit();
  renderFlow();
  await openFirstQuestionScreen();
  fireEvent.change(screen.getByRole("textbox", { name: /First impression/ }), {
    target: { value: "Helpful" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  fireEvent.click(await screen.findByRole("button", { name: taskFlow.submit }));

  const close = screen.getByRole("button", { name: taskFlow.closeTask });
  await waitFor(() => expect(close).toHaveProperty("disabled", true));
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  release();

  expect(
    await screen.findByRole("heading", { name: taskFlow.complete }),
  ).toBeTruthy();
});

it("reopens the screen the member navigated away from when they come back", async () => {
  renderFlow();
  await openFirstQuestionScreen();

  act(() => navigate("/forum"));
  await screen.findByText("Forum");

  act(() => navigate(-1));

  expect(
    await screen.findByRole("heading", { name: "Rate the chatbot" }),
  ).toBeTruthy();
});

it("doesn't reopen on the task's page a flow left from the home card", async () => {
  renderFlow({ path: "/" });
  await openFirstQuestionScreen();

  act(() => navigate("/forum"));
  await screen.findByText("Forum");
  act(() => navigate("/actions/1"));

  expect(
    await screen.findByRole("button", { name: taskFlow.continue }),
  ).toBeTruthy();
  await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
  expect(
    screen.queryByRole("heading", { name: "Rate the chatbot" }),
  ).toBeNull();
});

function TogglePanel() {
  const [shown, setShown] = useState(true);
  return (
    <>
      <button onClick={() => setShown(!shown)}>Toggle panel</button>
      {shown ? (
        <ActionTaskPanelForm
          taskFormId={9}
          onCompleteAction={() => {}}
          onFormStarted={() => {}}
          onDeadlinePassed={() => {}}
          action={action}
        />
      ) : null}
    </>
  );
}

it("doesn't reopen a flow that unmounted without the member leaving the page", async () => {
  window.happyDOM.setURL("http://localhost/actions/1");
  try {
    renderFlow({ page: <TogglePanel /> });
    await openFirstQuestionScreen();

    fireEvent.click(screen.getByRole("button", { name: "Toggle panel" }));
    fireEvent.click(screen.getByRole("button", { name: "Toggle panel" }));

    expect(
      await screen.findByRole("button", { name: taskFlow.continue }),
    ).toBeTruthy();
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(
      screen.queryByRole("heading", { name: "Rate the chatbot" }),
    ).toBeNull();
  } finally {
    window.happyDOM.setURL("about:blank");
  }
});

it("collapses the nav while the flow is open", async () => {
  renderFlow();
  expect(await screen.findByText("nav expanded")).toBeTruthy();

  await openFirstQuestionScreen();
  expect(screen.getByText("nav collapsed")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: taskFlow.closeTask }));
  expect(await screen.findByText("nav expanded")).toBeTruthy();
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

function PanelForRoute() {
  const actionId = useLocation().pathname === "/actions/2" ? 2 : 1;
  return (
    <ActionTaskPanelForm
      taskFormId={9}
      onCompleteAction={() => {}}
      onFormStarted={() => {}}
      onDeadlinePassed={() => {}}
      action={makeAction({ id: actionId, name: `Task ${actionId}` })}
    />
  );
}

it("starts closed on another action's page rather than carrying the flow over", async () => {
  renderFlow({ page: <PanelForRoute /> });
  await openFirstQuestionScreen();

  act(() => navigate("/actions/2"));

  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(screen.getByRole("button", { name: taskFlow.continue })).toBeTruthy();
});

const renderWithdrawable = (onAbandonAction: () => void = () => {}) =>
  renderFlow({
    page: (
      <ActionTaskPanelForm
        taskFormId={9}
        onCompleteAction={() => {}}
        onAbandonAction={onAbandonAction}
        onFormStarted={() => {}}
        onDeadlinePassed={() => {}}
        action={action}
      />
    ),
  });

const openWithdrawMenu = async (onAbandonAction: () => void = () => {}) => {
  renderWithdrawable(onAbandonAction);
  fireEvent.click(await screen.findByRole("button", { name: taskFlow.begin }));
  await screen.findByRole("heading", { name: taskFlow.background });
  fireEvent.click(screen.getByRole("button", { name: withdrawFromAction }));
};

it("closes the flow and forgets its screen when the member withdraws", async () => {
  const onAbandonAction = jest.fn();
  await openWithdrawMenu(onAbandonAction);
  fireEvent.click(
    screen.getByRole("button", { name: "Took more than 15 minutes" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Withdraw" }));

  await waitFor(() => expect(onAbandonAction).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(await screen.findByText("nav expanded")).toBeTruthy();
  expect(window.localStorage.getItem("taskflow-step:9")).toBeNull();
});

it("offers withdrawing on every step, including a one-page task's only step", async () => {
  setServedSchema({ pages: [taskSchema.pages[1]], outputViews: [] });
  renderWithdrawable();
  fireEvent.click(await screen.findByRole("button", { name: taskFlow.begin }));

  await screen.findByRole("heading", { name: "Rate the chatbot" });
  expect(screen.getByRole("button", { name: withdrawFromAction })).toBeTruthy();
});

it("offers withdrawing beside Begin while the flow is closed", async () => {
  const onAbandonAction = jest.fn();
  renderWithdrawable(onAbandonAction);
  await screen.findByRole("button", { name: taskFlow.begin });

  fireEvent.click(screen.getByRole("button", { name: withdrawFromAction }));
  fireEvent.click(
    screen.getByRole("button", { name: "Took more than 15 minutes" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Withdraw" }));

  await waitFor(() => expect(onAbandonAction).toHaveBeenCalledTimes(1));
  expect(screen.queryByRole("dialog")).toBeNull();
});

function InCard({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  return (
    <>
      <header ref={setSlot} />
      <CardMenuSlotContext.Provider value={slot}>
        {children}
      </CardMenuSlotContext.Provider>
    </>
  );
}

it("puts the withdraw menu in the card's header inside a task card", async () => {
  renderFlow({
    page: (
      <InCard>
        <ActionTaskPanelForm
          taskFormId={9}
          onCompleteAction={() => {}}
          onAbandonAction={() => {}}
          onFormStarted={() => {}}
          onDeadlinePassed={() => {}}
          action={action}
        />
      </InCard>
    ),
  });
  await screen.findByRole("button", { name: taskFlow.begin });

  expect(
    within(screen.getByRole("banner")).getByRole("button", {
      name: withdrawFromAction,
    }),
  ).toBeTruthy();
  expect(
    screen.getAllByRole("button", { name: withdrawFromAction }),
  ).toHaveLength(1);
});

it("closes only the withdraw menu when Escape dismisses it", async () => {
  await openWithdrawMenu();

  fireEvent.keyDown(screen.getByRole("button", { name: withdrawFromAction }), {
    key: "Escape",
  });

  expect(screen.queryByText("Withdrawal options")).toBeNull();
  await act(() => new Promise((resolve) => setTimeout(resolve, CLOSE_TIMEOUT)));
  expect(screen.getByRole("dialog")).toBeTruthy();
});
