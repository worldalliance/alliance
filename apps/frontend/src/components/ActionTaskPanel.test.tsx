import { MEMBER_ACTION_DEADLINE_PASSED } from "@alliance/common/actionActivity";
import { AnalyticsEvent } from "@alliance/common/analytics";
import * as analyticsModule from "@alliance/shared/lib/analytics";
import { makeAction, makeViewer } from "@alliance/shared/lib/testFixtures";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { SiteAppProvider } from "@alliance/sharedweb/ui/SiteAppProvider";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AuthContext } from "../lib/AuthContext";
import { testAuthUser } from "../stories/testData";
import { authValue } from "../testing/authValue";
import ActionTaskPanel, { type ActionTaskPanelProps } from "./ActionTaskPanel";

afterEach(cleanup);

// Only the form fetch is routed, so a submit or guest-draft request fails the test.
const api = serveApi(
  routes({
    "GET /tasks/slug/:id": () =>
      Response.json({
        id: 7,
        title: "task",
        formSnapshotId: 1,
        schema: {
          pages: [
            {
              id: "p1",
              fields: [
                { id: "f1", type: "input", kind: "text", label: "Your name" },
              ],
            },
          ],
          outputViews: [],
        },
      }),
  }),
);

beforeEach(() => localStorage.clear());

const renderPanel = (
  props: Pick<ActionTaskPanelProps, "action"> &
    Partial<
      Pick<ActionTaskPanelProps, "onCompleteAction" | "onDeadlinePassed">
    >,
) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <SiteAppProvider>
          <AuthContext.Provider value={authValue({ user: testAuthUser })}>
            <ToastProvider>
              <ActionTaskPanel
                userRelation="none"
                onCompleteAction={() => {}}
                onOptOutAction={() => {}}
                onDeadlinePassed={() => {}}
                {...props}
              />
            </ToastProvider>
          </AuthContext.Provider>
        </SiteAppProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("ActionTaskPanel in staff preview", () => {
  it("lets staff type into the form without submitting, keeping it, or tracking a form start", async () => {
    const onCompleteAction = jest.fn();
    const captureEvent = jest.spyOn(analyticsModule, "captureEvent");
    renderPanel({
      action: makeAction({
        taskFormId: 7,
        status: "draft",
        viewer: makeViewer({
          memberActionStarted: false,
          staffPreview: true,
        }),
      }),
      onCompleteAction,
    });

    fireEvent.change(await screen.findByRole("textbox"), {
      target: { value: "Ada" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Preview Mode/ }));
    });

    expect(screen.getByRole<HTMLInputElement>("textbox").value).toBe("Ada");
    expect(onCompleteAction).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
    expect(captureEvent).not.toHaveBeenCalledWith(
      AnalyticsEvent.FormStarted,
      expect.anything(),
    );
  });
});

describe("ActionTaskPanel past the deadline", () => {
  it("hands the server's deadline refusal to onDeadlinePassed", async () => {
    api.alsoServing({
      "GET /tasks/draft/:id": () => Response.json({}),
      "GET /tasks/formDraft/:id": () => Response.json({}),
      "POST /tasks/submitForm/:id": () =>
        Response.json(
          { statusCode: 403, message: MEMBER_ACTION_DEADLINE_PASSED },
          { status: 403 },
        ),
    });
    const onDeadlinePassed = jest.fn();
    renderPanel({ action: makeAction({ taskFormId: 7 }), onDeadlinePassed });

    fireEvent.change(await screen.findByRole("textbox"), {
      target: { value: "Ada" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Complete" }));
    });

    expect(await screen.findByText(MEMBER_ACTION_DEADLINE_PASSED)).toBeTruthy();
    expect(onDeadlinePassed).toHaveBeenCalledTimes(1);
  });
});
