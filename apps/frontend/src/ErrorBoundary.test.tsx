import { cleanup, render, screen } from "@testing-library/react";
import { ErrorBoundary } from "./ErrorBoundary";

const notFound = {
  status: 404,
  statusText: "Not Found",
  internal: false,
  data: "Custom link not found",
};

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
  if (initialProd === undefined) delete process.env.PROD;
  else process.env.PROD = initialProd;
});

describe("ErrorBoundary in production", () => {
  beforeEach(() => setProd(true));

  test("shows only the status of a route error", () => {
    render(<ErrorBoundary error={notFound} params={{}} />);
    screen.getByText("404 Not Found");
    expect(screen.queryByText("Custom link not found")).toBeNull();
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
    render(<ErrorBoundary error={notFound} params={{}} />);
    screen.getByText("404 Not Found");
    screen.getByText("Custom link not found");
  });

  test("shows the stack of a thrown error", () => {
    render(<ErrorBoundary error={thrownError()} params={{}} />);
    expect(document.body.textContent).toContain("secretFrame");
  });
});
