import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
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

  test("keeps the hash the member returned to", async () => {
    router = createMemoryRouter([{ path: "/settings", element: <Page /> }], {
      initialEntries: ["/settings?apple=linked&tab=1#account"],
    });
    render(<RouterProvider router={router} />);

    await waitFor(() => expect(router.state.location.search).toBe("?tab=1"));
    expect(router.state.location.hash).toBe("#account");
  });

  test("leaves later navigations alone once stripped", async () => {
    router = createMemoryRouter([{ path: "/settings", element: <Page /> }], {
      initialEntries: ["/settings?apple=linked"],
    });
    render(<RouterProvider router={router} />);
    await waitFor(() => expect(router.state.location.search).toBe(""));

    const locations: string[] = [];
    router.subscribe(({ location }) => {
      if (location.key !== locations.at(-1)) locations.push(location.key);
    });
    await act(() => router.navigate("/settings?tab=2"));

    expect(locations).toHaveLength(1);
  });
});
