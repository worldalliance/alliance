import type { AdminActionUpdateDto } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import LeaveGuard from "../../../components/LeaveGuard";
import { actionUpdateAdmin as update } from "../../../lib/testing/actionUpdateAdmin";
import { ShortcutsProvider } from "../../../shell/shortcuts";
import { ToastProvider } from "../../../ui/ToastProvider";
import TaskUpdatePage from "./TaskUpdatePage";

/** Called at a test file's top level: `serveApi` registers that file's hooks. */
export const setupTaskUpdatePage = () => {
  const state: { served: AdminActionUpdateDto; countedAudiences: unknown[] } = {
    served: update(),
    countedAudiences: [],
  };

  const api = serveApi(
    routes({
      "GET /actions/updates/admin/:id": () => Response.json(state.served),
      "GET /actions/adminslug/:id": () =>
        Response.json({
          id: 2,
          taskFormId: null,
          taskKind: "form",
          events: [
            {
              id: 5,
              title: "Launch",
              date: "2026-09-01T00:00:00.000Z",
            },
          ],
        }),
      "GET /user/tags": () => Response.json([]),
      "GET /tasks/listForms": () => Response.json([]),
      "POST /actions/updates/:id/recognition-preview-counts": async ({
        request,
      }) => {
        state.countedAudiences.push(await request.json());
        return Response.json({
          completed: 2,
          didNotComplete: 3,
          uninvolved: 4,
        });
      },
    }),
  );

  const renderPage = (
    params: { path?: string; cached?: AdminActionUpdateDto } = {},
  ) => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    if (params.cached) {
      client.setQueryData(queryKeys.actionUpdateAdmin(1), params.cached);
    }
    const router = createMemoryRouter(
      [
        {
          path: "/tasks/:actionId/updates/:updateId",
          element: (
            <LeaveGuard>
              <TaskUpdatePage />
            </LeaveGuard>
          ),
        },
        { path: "/tasks/:actionId", element: <p>Action page</p> },
      ],
      { initialEntries: [params.path ?? "/tasks/2/updates/1"] },
    );
    render(
      <QueryClientProvider client={client}>
        <ToastProvider>
          <ShortcutsProvider>
            <RouterProvider router={router} />
          </ShortcutsProvider>
        </ToastProvider>
      </QueryClientProvider>,
    );
    return router;
  };

  const renderDetails = async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("tab", { name: "Details" }));
    await screen.findByRole("textbox", { name: "Title" });
  };

  return { state, api, renderPage, renderDetails };
};
