import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, type Mock, spyOn } from "bun:test";
import {
  createMemoryRouter,
  Link,
  type NavigateFunction,
  RouterProvider,
  useNavigate,
} from "react-router";
import {
  BUILD_CHECK_INTERVAL_MS,
  useFullLoadOnNewBuild,
} from "./useFullLoadOnNewBuild";

declare global {
  interface Window {
    happyDOM: { setURL: (url: string) => void };
  }
}

const startUrl = window.location.href;
afterEach(() => window.happyDOM.setURL(startUrl));

const BUILT_SHA = "aaa";
let builtSha: string | undefined;

let navigate: NavigateFunction = () => {
  throw new Error("router not rendered");
};

const Page = () => {
  useFullLoadOnNewBuild(builtSha);
  navigate = useNavigate();
  return <Link to="/b?tab=1">to b</Link>;
};

let assignSpy: Mock<Location["assign"]>;
let replaceSpy: Mock<Location["replace"]>;
let fetchSpy: Mock<typeof fetch>;

beforeEach(() => {
  builtSha = BUILT_SHA;
  fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({ sha: BUILT_SHA }),
  );
  assignSpy = spyOn(window.location, "assign").mockImplementation(() => {});
  replaceSpy = spyOn(window.location, "replace").mockImplementation(() => {});
});

const renderAt = (...initialEntries: string[]) => {
  const router = createMemoryRouter(
    ["/a", "/b", "/people", "/signup"].map((p) => ({
      path: p,
      Component: Page,
    })),
    { initialEntries, initialIndex: initialEntries.length - 1 },
  );
  render(<RouterProvider router={router} />);
  return router;
};

const deployNewBuild = () =>
  fetchSpy.mockResolvedValue(Response.json({ sha: "bbb" }));

const becomeVisible = () =>
  act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

it("navigates in-app while the server runs this tab's build", async () => {
  const router = renderAt("/a");
  await becomeVisible();
  expect(fetchSpy).toHaveBeenCalledTimes(1);
  await act(() => navigate("/b"));
  expect(router.state.location.pathname).toBe("/b");
  expect(assignSpy).not.toHaveBeenCalled();
});

it("loads the next page as a document once the server reports another build", async () => {
  const router = renderAt("/a");
  deployNewBuild();
  await becomeVisible();
  await act(() => navigate("/b?tab=1"));
  expect(assignSpy).toHaveBeenCalledWith("/b?tab=1");
  expect(router.state.location.pathname).toBe("/a");
});

it("replaces the entry for a replace navigation", async () => {
  renderAt("/a");
  deployNewBuild();
  await becomeVisible();
  await act(() => navigate("/b", { replace: true }));
  expect(replaceSpy).toHaveBeenCalledWith("/b");
  expect(assignSpy).not.toHaveBeenCalled();
});

it("keeps search changes on the same page in-app", async () => {
  const router = renderAt("/a");
  deployNewBuild();
  await becomeVisible();
  await act(() => navigate("/a?tab=2"));
  expect(router.state.location.search).toBe("?tab=2");
  expect(assignSpy).not.toHaveBeenCalled();

  await act(() => navigate("/b"));
  expect(assignSpy).toHaveBeenCalledWith("/b");
});

it("ignores a failed check", async () => {
  fetchSpy.mockRejectedValue(new TypeError("offline"));
  const router = renderAt("/a");
  await becomeVisible();
  await act(() => navigate("/b"));
  expect(router.state.location.pathname).toBe("/b");
  expect(assignSpy).not.toHaveBeenCalled();
});

it("ignores a server restarting into a deploy", async () => {
  fetchSpy.mockResolvedValue(new Response(null, { status: 502 }));
  const errorSpy = spyOn(console, "error").mockImplementation(() => {});
  renderAt("/a");
  await becomeVisible();
  expect(errorSpy).not.toHaveBeenCalled();
  errorSpy.mockRestore();
});

it("logs an error status that won't clear on its own", async () => {
  fetchSpy.mockResolvedValue(new Response(null, { status: 404 }));
  const errorSpy = spyOn(console, "error").mockImplementation(() => {});
  const router = renderAt("/a");
  await becomeVisible();
  expect(String(errorSpy.mock.calls[0]?.[1])).toContain("HTTP 404");
  errorSpy.mockRestore();
  await act(() => navigate("/b"));
  expect(router.state.location.pathname).toBe("/b");
});

it("keeps a navigation that carries state in-app", async () => {
  const router = renderAt("/a");
  deployNewBuild();
  await becomeVisible();
  await act(() => navigate("/b", { state: { message: "saved" } }));
  expect(router.state.location.state).toEqual({ message: "saved" });
  expect(assignSpy).not.toHaveBeenCalled();
});

it("ignores a response that isn't JSON", async () => {
  fetchSpy.mockResolvedValue(new Response("<html>"));
  const errorSpy = spyOn(console, "error").mockImplementation(() => {});
  const router = renderAt("/a");
  await becomeVisible();
  expect(errorSpy.mock.calls[0]?.[1]).toBeInstanceOf(SyntaxError);
  errorSpy.mockRestore();
  await act(() => navigate("/b"));
  expect(router.state.location.pathname).toBe("/b");
});

it("keeps back and forward in-app", async () => {
  const router = renderAt("/b", "/a");
  deployNewBuild();
  await becomeVisible();
  await act(() => navigate(-1));
  expect(router.state.location.pathname).toBe("/b");
  expect(assignSpy).not.toHaveBeenCalled();
  expect(replaceSpy).not.toHaveBeenCalled();
});

it("keeps a navigation to a page nginx moves to the alt domain in-app", async () => {
  window.happyDOM.setURL("https://worldalliance.org/a");
  const router = renderAt("/a");
  deployNewBuild();
  await becomeVisible();
  await act(() => navigate("/people"));
  expect(router.state.location.pathname).toBe("/people");
  expect(assignSpy).not.toHaveBeenCalled();
});

it("loads a page nginx moves as a document once on the alt domain", async () => {
  window.happyDOM.setURL("https://thealliance.org/a");
  renderAt("/a");
  deployNewBuild();
  await becomeVisible();
  await act(() => navigate("/people"));
  expect(assignSpy).toHaveBeenCalledWith("/people");
});

it("keeps an invite signup in-app on the primary domain", async () => {
  window.happyDOM.setURL("https://worldalliance.org/a");
  const router = renderAt("/a");
  deployNewBuild();
  await becomeVisible();
  await act(() => navigate("/signup?ref=CODE"));
  expect(router.state.location.pathname).toBe("/signup");
  expect(assignSpy).not.toHaveBeenCalled();
});

it("loads an invite signup as a document on the alt domain", async () => {
  window.happyDOM.setURL("https://thealliance.org/a");
  renderAt("/a");
  deployNewBuild();
  await becomeVisible();
  await act(() => navigate("/signup?ref=CODE"));
  expect(assignSpy).toHaveBeenCalledWith("/signup?ref=CODE");
});

it("ignores a server build that carries no SHA", async () => {
  fetchSpy.mockResolvedValue(Response.json({ sha: null }));
  const router = renderAt("/a");
  await becomeVisible();
  await act(() => navigate("/b"));
  expect(router.state.location.pathname).toBe("/b");
  expect(assignSpy).not.toHaveBeenCalled();
});

it("checks on the interval only while the tab is visible", async () => {
  const intervalSpy = spyOn(globalThis, "setInterval");
  renderAt("/a");
  const tick = intervalSpy.mock.calls.find(
    ([, ms]) => ms === BUILD_CHECK_INTERVAL_MS,
  )?.[0];
  intervalSpy.mockRestore();
  if (typeof tick !== "function") throw new Error("no check interval");

  await act(async () => tick());
  expect(fetchSpy).toHaveBeenCalledTimes(1);

  Object.defineProperty(document, "hidden", {
    value: true,
    configurable: true,
  });
  await act(async () => tick());
  Reflect.deleteProperty(document, "hidden");
  expect(fetchSpy).toHaveBeenCalledTimes(1);
});

it("never checks when the build carries no SHA", async () => {
  builtSha = undefined;
  renderAt("/a");
  await becomeVisible();
  expect(fetchSpy).not.toHaveBeenCalled();
});
