import { useActionsQuery } from "@alliance/shared/lib/actionsListPage";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { useUnreadGeneralUpdates } from "@alliance/shared/lib/useGeneralUpdates";
import useGlobalFeed from "@alliance/shared/lib/useGlobalFeed";
import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it } from "bun:test";
import { createElement, type ReactNode } from "react";
import { createMemoryRouter } from "react-router";
import { queryClient } from "../../lib/queryClient";
import { clientLoader, shouldRevalidate } from "./HomePage";

const requests: Record<string, number> = {};
const counted = (route: string) => () => {
  requests[route] = (requests[route] ?? 0) + 1;
  return Response.json([]);
};

afterEach(() => {
  queryClient.clear();
  for (const route of Object.keys(requests)) delete requests[route];
});

serveApi(
  routes({
    "GET /actions/loggedIn": counted("actions"),
    "GET /actions/generalUpdates/unread": counted("generalUpdates"),
    "GET /actions/globalFeed": counted("globalFeed"),
  }),
);

it("loads the page's queries once, before the page mounts", async () => {
  expect(clientLoader()).toBeNull();
  await waitFor(() =>
    expect(requests).toEqual({ actions: 1, generalUpdates: 1, globalFeed: 1 }),
  );

  const { result } = renderHook(
    () => ({
      actions: useActionsQuery(),
      generalUpdates: useUnreadGeneralUpdates(),
      globalFeed: useGlobalFeed({ limit: 10 }),
    }),
    {
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client: queryClient }, children),
    },
  );
  await waitFor(() => expect(result.current.actions.isSuccess).toBe(true));
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(requests).toEqual({ actions: 1, generalUpdates: 1, globalFeed: 1 });
});

it("doesn't refetch when only the search params change", async () => {
  const router = createMemoryRouter(
    [
      {
        path: "/tasks",
        loader: clientLoader,
        shouldRevalidate,
        Component: () => null,
      },
    ],
    { initialEntries: ["/tasks"] },
  );
  await waitFor(() =>
    expect(requests).toEqual({ actions: 1, generalUpdates: 1, globalFeed: 1 }),
  );

  await router.navigate("/tasks?walkthrough=1", { replace: true });
  await new Promise((resolve) => setTimeout(resolve, 50));

  expect(requests).toEqual({ actions: 1, generalUpdates: 1, globalFeed: 1 });
});
