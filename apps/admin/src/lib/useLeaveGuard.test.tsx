import { act, render, screen } from "@testing-library/react";
import {
  createMemoryRouter,
  Outlet,
  RouterProvider,
  type RouteObject,
} from "react-router";
import LeaveGuard from "../components/LeaveGuard";
import { useLeaveGuard, withoutLeaveGuard } from "./useLeaveGuard";

const Clean = () => {
  useLeaveGuard(false);
  return null;
};

const Page = ({ dirty, nested }: { dirty: boolean; nested?: boolean }) => {
  useLeaveGuard(dirty);
  return nested ? <Clean /> : null;
};

const routerWith = (page: RouteObject["element"]) => {
  const router = createMemoryRouter(
    [
      {
        element: (
          <LeaveGuard>
            <Outlet />
          </LeaveGuard>
        ),
        children: [
          { path: "/a", element: page },
          { path: "/b", element: null },
        ],
      },
    ],
    { initialEntries: ["/a"] },
  );
  render(<RouterProvider router={router} />);
  return router;
};

const leave = async (
  router: ReturnType<typeof routerWith>,
  to: string,
  answer: boolean,
) => {
  const confirm = jest.spyOn(window, "confirm").mockReturnValue(answer);
  await act(() => router.navigate(to));
  return confirm.mock.calls.length;
};

it("keeps the page when staff decline to discard unsaved changes", async () => {
  const router = routerWith(<Page dirty />);

  expect(await leave(router, "/b", false)).toBe(1);
  expect(router.state.location.pathname).toBe("/a");
});

it("leaves once staff agree to discard unsaved changes", async () => {
  const router = routerWith(<Page dirty />);

  expect(await leave(router, "/b", true)).toBe(1);
  expect(router.state.location.pathname).toBe("/b");
});

it("leaves a clean page without asking", async () => {
  const router = routerWith(<Page dirty={false} />);

  expect(await leave(router, "/b", false)).toBe(0);
  expect(router.state.location.pathname).toBe("/b");
});

it("still asks for a clean page whose nested guard is dirty", async () => {
  const Dirty = () => {
    useLeaveGuard(true);
    return null;
  };
  const CleanAround = () => {
    useLeaveGuard(false);
    return <Dirty />;
  };
  const router = routerWith(<CleanAround />);

  expect(await leave(router, "/b", false)).toBe(1);
  expect(router.state.location.pathname).toBe("/a");
});

it("still asks for a dirty page whose nested guard is clean", async () => {
  const router = routerWith(<Page dirty nested />);

  expect(await leave(router, "/b", false)).toBe(1);
  expect(router.state.location.pathname).toBe("/a");
});

const Strict = () => {
  useLeaveGuard(true);
  return null;
};

it("lets a navigation run past every guard, then guards again", async () => {
  const router = routerWith(<Strict />);
  const confirm = jest.spyOn(window, "confirm").mockReturnValue(false);

  await act(async () =>
    withoutLeaveGuard(() => void router.navigate("/a?saved=1")),
  );
  expect(confirm).not.toHaveBeenCalled();
  expect(router.state.location.search).toBe("?saved=1");

  await act(() => router.navigate("/b"));
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(router.state.location.pathname).toBe("/a");
});

it("guards again after a bypassed navigation throws", async () => {
  const router = routerWith(<Strict />);

  expect(() =>
    withoutLeaveGuard(() => {
      throw new Error("navigation failed");
    }),
  ).toThrow("navigation failed");

  expect(await leave(router, "/b", false)).toBe(1);
  expect(router.state.location.pathname).toBe("/a");
});

it("stops a reload of a dirty page", () => {
  routerWith(<Page dirty />);
  const event = new Event("beforeunload", { cancelable: true });

  window.dispatchEvent(event);

  expect(event.defaultPrevented).toBe(true);
});

it("refuses to run outside LeaveGuard, where navigations would go unasked", () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  const router = createMemoryRouter([{ path: "/", element: <Clean /> }]);

  render(<RouterProvider router={router} />);

  expect(
    screen.getByText("useLeaveGuard needs a LeaveGuard above it"),
  ).toBeTruthy();
});
