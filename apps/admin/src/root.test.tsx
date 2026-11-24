import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, spyOn } from "bun:test";
import posthog from "posthog-js";
import {
  createMemoryRouter,
  RouterProvider,
  useParams,
  useRouteError,
} from "react-router";
import { beforeSend, captureRouteError, syncStaff } from "./lib/analytics";
import { ErrorBoundary } from "./root";

const staff = { id: 7, email: "staff@example.org", name: "Staff" };
let authMeCalls = 0;
let isImpersonation = false;

serveApi(
  routes({
    "GET /auth/me": () => {
      authMeCalls++;
      return Response.json({
        user: { ...staff, admin: true },
        isImpersonation,
      });
    },
  }),
);

const sent: unknown[] = [];

beforeEach(() => {
  sent.splice(0);
  authMeCalls = 0;
  isImpersonation = false;
  syncStaff(undefined);
  posthog.__loaded = true;
  spyOn(posthog, "get_property").mockImplementation(() => "anonymous");
  spyOn(posthog, "identify").mockImplementation(() => undefined);
  spyOn(posthog, "captureException").mockImplementation((error) => {
    if (beforeSend({ uuid: "u", event: "$exception", properties: {} })) {
      sent.push(error);
    }
    return undefined;
  });
  spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  syncStaff(undefined);
  posthog.__loaded = false;
});

function Boundary() {
  return <ErrorBoundary error={useRouteError()} params={useParams()} />;
}

const renderError = async (error: Error) => {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        ErrorBoundary: Boundary,
        children: [
          {
            path: "members",
            Component: () => {
              throw error;
            },
          },
        ],
      },
    ],
    { initialEntries: ["/members"] },
  );
  await act(async () => {
    render(<RouterProvider router={router} onError={captureRouteError} />);
  });
};

it("sends an error on a page's first load once the error boundary identifies staff", async () => {
  const error = new Error("boom");
  await renderError(error);
  await waitFor(() => expect(sent).toEqual([error]));
});

it("drops a held error once the error boundary settles identity without staff", async () => {
  isImpersonation = true;
  await renderError(new Error("boom"));
  await waitFor(() => expect(authMeCalls).toBe(1));
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
  syncStaff(staff);

  expect(sent).toEqual([]);
});

it("leaves auth alone on the error boundary once staff is identified", async () => {
  syncStaff(staff);
  const error = new Error("boom");
  await renderError(error);
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)));

  expect(sent).toEqual([error]);
  expect(authMeCalls).toBe(0);
});

it("leaves auth alone on the error boundary when PostHog isn't loaded", async () => {
  posthog.__loaded = false;
  await renderError(new Error("boom"));
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)));

  expect(authMeCalls).toBe(0);
});
