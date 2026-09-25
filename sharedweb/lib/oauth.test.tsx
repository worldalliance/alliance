import { OAuthIntent, OAuthProvider } from "@alliance/common/oauth";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import {
  createMemoryRouter,
  RouterProvider,
  ScrollRestoration,
} from "react-router";
import { oauthStartUrl, useOAuthNotice } from "./oauth";

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

describe("oauthStartUrl", () => {
  const startUrl = () =>
    new URL(
      oauthStartUrl({
        apiUrl: "http://api.example.com",
        provider: OAuthProvider.Google,
        intent: OAuthIntent.Authenticate,
        returnTo: "http://app.example.com/join",
      }),
    );

  const detectZone = (timeZone: string) =>
    jest
      .spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions")
      .mockReturnValue({
        ...new Intl.DateTimeFormat().resolvedOptions(),
        timeZone,
      });

  afterEach(() => jest.restoreAllMocks());

  test("carries a valid device zone", () => {
    detectZone("Europe/Berlin");
    expect(startUrl().searchParams.get("timeZone")).toBe("Europe/Berlin");
  });

  test("leaves off a zone the server would refuse", () => {
    detectZone("-08:00");
    expect(startUrl().searchParams.has("timeZone")).toBe(false);
  });
});
