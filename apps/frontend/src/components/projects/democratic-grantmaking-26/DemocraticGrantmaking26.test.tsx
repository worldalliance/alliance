import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AuthContext } from "../../../lib/AuthContext";
import { authValue } from "../../../testing/authValue";
import DemocraticGrantmaking26 from "./DemocraticGrantmaking26";

serveApi(routes({}));

afterEach(cleanup);

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthContext.Provider value={authValue()}>
        <MemoryRouter>
          <DemocraticGrantmaking26 />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );

test("marks preparation as the current phase", () => {
  renderPage();

  const current = screen
    .getByRole("region", { name: "Timeline" })
    .querySelector('[aria-current="step"]');
  expect(current?.textContent).toContain("Preparation");
});

test("stacks members and waitlist against the member goal", () => {
  renderPage();

  const bar = screen.getByRole("img", {
    name: "213 members and 309 on the waitlist, toward 1,000",
  });
  const [members, waitlist] = Array.from(
    bar.querySelectorAll<HTMLElement>(":scope > div"),
    (segment) => segment.style.width,
  );
  expect(members).toBe("21.3%");
  expect(waitlist).toBe("30.9%");
});

test("the waitlist form stays on the page when submitted", () => {
  renderPage();

  const form = screen
    .getByRole("button", { name: "Join the Waitlist" })
    .closest("form");
  if (!form) throw new Error("Join the Waitlist is outside a form");
  const submit = new Event("submit", { bubbles: true, cancelable: true });
  fireEvent(form, submit);
  expect(submit.defaultPrevented).toBe(true);
});
