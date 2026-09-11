import { cleanup, render, screen, waitFor } from "@testing-library/react";
import {
  createMemoryRouter,
  RouterProvider,
  ScrollRestoration,
} from "react-router";
import { useOAuthNotice } from "./oauth";

let router: ReturnType<typeof createMemoryRouter>;
const resetsAt: string[] = [];
const realScrollTo = window.scrollTo;
window.scrollTo = () => {
  resetsAt.push(router.state.location.search);
};

afterEach(cleanup);

afterAll(() => {
  window.scrollTo = realScrollTo;
});

const Page = () => {
  const notice = useOAuthNotice();
  return (
    <>
      <ScrollRestoration />
      {notice && <p>notice</p>}
    </>
  );
};

describe("useOAuthNotice", () => {
  test("leaves the member where they were when it strips the parameter", async () => {
    router = createMemoryRouter([{ path: "/settings", element: <Page /> }], {
      initialEntries: ["/settings?appleError=claimed_by_another_account"],
    });
    render(<RouterProvider router={router} />);

    await screen.findByText("notice");
    await waitFor(() => expect(router.state.location.search).toBe(""));

    // ScrollRestoration resets once on mount, while the parameter is still
    // there. A second reset, at the stripped URL, is the bug.
    expect(resetsAt).toEqual(["?appleError=claimed_by_another_account"]);
  });
});
