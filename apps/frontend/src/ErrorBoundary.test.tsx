import * as analyticsModule from "@alliance/shared/lib/analytics";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { ErrorBoundary } from "./ErrorBoundary";
import { AuthContext } from "./lib/AuthContext";
import { InviteSessionProvider } from "./site/invite/InviteSession";
import { NotFoundSource } from "./site/NotFoundPage";
import { authValue } from "./testing/authValue";

const unavailable = {
  status: 503,
  statusText: "Service Unavailable",
  internal: false,
  data: "Custom links are unavailable",
};

const notFound = (data: unknown) => ({
  status: 404,
  statusText: "Not Found",
  internal: false,
  data,
});

function thrownError() {
  const error = new Error("boom");
  error.stack = "Error: boom\n    at secretFrame (server.js:1:1)";
  return error;
}

const initialProd = process.env.PROD;

function setProd(prod: boolean) {
  if (prod) process.env.PROD = "true";
  else delete process.env.PROD;
}

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
  if (initialProd === undefined) delete process.env.PROD;
  else process.env.PROD = initialProd;
});

describe("ErrorBoundary in production", () => {
  beforeEach(() => setProd(true));

  test("shows only the status of a route error", () => {
    render(<ErrorBoundary error={unavailable} params={{}} />);
    screen.getByText("503 Service Unavailable");
    expect(screen.queryByText("Custom links are unavailable")).toBeNull();
  });

  test("hides the stack of a thrown error", () => {
    render(<ErrorBoundary error={thrownError()} params={{}} />);
    screen.getByText("Please try again");
    expect(document.body.textContent).not.toContain("secretFrame");
  });
});

describe("ErrorBoundary in development", () => {
  beforeEach(() => setProd(false));

  test("shows the body of a route error", () => {
    render(<ErrorBoundary error={unavailable} params={{}} />);
    screen.getByText("503 Service Unavailable");
    screen.getByText("Custom links are unavailable");
  });

  test("shows the stack of a thrown error", () => {
    render(<ErrorBoundary error={thrownError()} params={{}} />);
    expect(document.body.textContent).toContain("secretFrame");
  });
});

describe("ErrorBoundary on a 404", () => {
  const renderNotFound = (data: unknown) =>
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AuthContext.Provider value={authValue()}>
          <MemoryRouter initialEntries={["/nowhere"]}>
            <InviteSessionProvider>
              <ErrorBoundary error={notFound(data)} params={{}} />
            </InviteSessionProvider>
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>,
    );

  test.each([
    [
      "an unmatched route",
      "Custom link not found",
      NotFoundSource.UnmatchedRoute,
    ],
    [
      "a missing record",
      NotFoundSource.MissingRecord,
      NotFoundSource.MissingRecord,
    ],
  ])("shows the not-found page for %s", (_, data, source) => {
    const captureEvent = jest.spyOn(analyticsModule, "captureEvent");

    renderNotFound(data);

    screen.getByRole("heading", { name: "We couldn’t find that page" });
    expect(document.body.textContent).not.toContain("404");
    expect(captureEvent).toHaveBeenCalledWith(expect.anything(), {
      path: "/nowhere",
      source,
    });
  });
});
