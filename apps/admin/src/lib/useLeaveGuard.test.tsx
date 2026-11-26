import { act, render, screen, waitFor } from "@testing-library/react";
import { useLayoutEffect, useState } from "react";
import {
  createMemoryRouter,
  Outlet,
  RouterProvider,
  type RouteObject,
} from "react-router";
import LeaveGuard from "../components/LeaveGuard";
import { answerLeaveGuard } from "./testing/leaveGuard";
import { useLeaveGuard } from "./useLeaveGuard";

const Clean = () => {
  useLeaveGuard(false);
  return null;
};

const Strict = () => {
  useLeaveGuard(true);
  return null;
};

const Page = ({ dirty, nested }: { dirty: boolean; nested?: boolean }) => {
  useLeaveGuard(dirty, { allowSamePath: true });
  return nested ? <Clean /> : null;
};

const routerWith = (
  page: RouteObject["element"],
  landing: RouteObject["element"] = null,
) => {
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
          { path: "/b", element: landing },
          { path: "/c", element: null },
        ],
      },
    ],
    { initialEntries: ["/a"] },
  );
  render(<RouterProvider router={router} />);
  return router;
};

const leave = async ({
  router,
  to,
  answer,
}: {
  router: ReturnType<typeof routerWith>;
  to: string;
  answer: boolean;
}) => {
  const confirm = answerLeaveGuard(answer);
  await act(() => router.navigate(to));
  return confirm.mock.calls.length;
};

it("keeps the page when staff decline to discard unsaved changes", async () => {
  const router = routerWith(<Page dirty />);

  expect(await leave({ router, to: "/b", answer: false })).toBe(1);
  expect(router.state.location.pathname).toBe("/a");
});

it("leaves once staff agree to discard unsaved changes", async () => {
  const router = routerWith(<Page dirty />);

  expect(await leave({ router, to: "/b", answer: true })).toBe(1);
  expect(router.state.location.pathname).toBe("/b");
});

it("leaves a clean page without asking", async () => {
  const router = routerWith(<Page dirty={false} />);

  expect(await leave({ router, to: "/b", answer: false })).toBe(0);
  expect(router.state.location.pathname).toBe("/b");
});

it("lets a change of search params through where the guard allows the same path", async () => {
  const router = routerWith(<Page dirty />);

  expect(await leave({ router, to: "/a?tab=events", answer: false })).toBe(0);
  expect(router.state.location.search).toBe("?tab=events");
});

it("asks before a change of search params by default", async () => {
  const router = routerWith(<Strict />);

  expect(await leave({ router, to: "/a?tab=events", answer: false })).toBe(1);
  expect(router.state.location.search).toBe("");
});

const Peeking = () => {
  useLeaveGuard(true, { ignoreParams: ["member"] });
  return null;
};

it("lets a change of only the ignored params through", async () => {
  const router = routerWith(<Peeking />);

  expect(await leave({ router, to: "/a?member=1", answer: false })).toBe(0);
  expect(router.state.location.search).toBe("?member=1");
  expect(await leave({ router, to: "/a", answer: false })).toBe(0);
  expect(router.state.location.search).toBe("");
});

it.each(["/a?tab=events&member=1", "/b?member=1"])(
  "asks before %s, which changes more than the ignored params",
  async (to) => {
    const router = routerWith(<Peeking />);

    expect(await leave({ router, to, answer: false })).toBe(1);
    expect(router.state.location.pathname + router.state.location.search).toBe(
      "/a",
    );
  },
);

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

  expect(await leave({ router, to: "/b", answer: false })).toBe(1);
  expect(router.state.location.pathname).toBe("/a");
});

it("still asks for a dirty page whose nested guard is clean", async () => {
  const router = routerWith(<Page dirty nested />);

  expect(await leave({ router, to: "/b", answer: false })).toBe(1);
  expect(router.state.location.pathname).toBe("/a");
});

it("still asks for a dirty page a change of search params kept mounted, before it renders again", async () => {
  const router = routerWith(<Page dirty />);
  const confirm = answerLeaveGuard(false);

  await act(async () => {
    void router.navigate("/a?tab=events");
    void router.navigate("/b");
  });

  expect(confirm).toHaveBeenCalledTimes(1);
  expect(router.state.location.pathname).toBe("/a");
});

let navigateUnprompted: (navigate: () => void) => void = () => {};
const Bypassing = () => {
  navigateUnprompted = useLeaveGuard(true);
  return null;
};
const BypassingSamePath = () => {
  navigateUnprompted = useLeaveGuard(true, { allowSamePath: true });
  return null;
};

it("lets a navigation run past its own guard, then guards again", async () => {
  const router = routerWith(<Bypassing />);
  const confirm = answerLeaveGuard(false);

  await act(async () =>
    navigateUnprompted(() => void router.navigate("/a?saved=1")),
  );
  expect(confirm).not.toHaveBeenCalled();
  expect(router.state.location.search).toBe("?saved=1");

  await act(() => router.navigate("/b"));
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(router.state.location.pathname).toBe("/a");
});

it("still asks for another dirty guard when one guard's navigation runs unprompted", async () => {
  const router = routerWith(
    <>
      <Bypassing />
      <Strict />
    </>,
  );
  const confirm = answerLeaveGuard(false);

  await act(async () => navigateUnprompted(() => void router.navigate("/b")));

  expect(confirm).toHaveBeenCalledTimes(1);
  expect(router.state.location.pathname).toBe("/a");
});

it("lets staff leave a page an unprompted navigation left before its guard is removed", async () => {
  // A layout effect on the next page runs before the left page's passive
  // effect cleanup, which is what removes its guard.
  const LeavesOnMount = () => {
    useLayoutEffect(() => void router.navigate("/c"), []);
    return null;
  };
  const router = routerWith(<Bypassing />, <LeavesOnMount />);
  const confirm = answerLeaveGuard(false);

  await act(async () => navigateUnprompted(() => void router.navigate("/b")));

  await waitFor(() => expect(router.state.location.pathname).toBe("/c"));
  expect(confirm).not.toHaveBeenCalled();
});

it("guards again after an unprompted navigation throws", async () => {
  const router = routerWith(<Bypassing />);

  expect(() =>
    navigateUnprompted(() => {
      throw new Error("navigation failed");
    }),
  ).toThrow("navigation failed");

  expect(await leave({ router, to: "/b", answer: false })).toBe(1);
  expect(router.state.location.pathname).toBe("/a");
});

it("still asks for a dirty page a change of search params kept mounted after an unprompted navigation throws", async () => {
  const router = routerWith(<BypassingSamePath />);
  expect(() =>
    navigateUnprompted(() => {
      throw new Error("navigation failed");
    }),
  ).toThrow("navigation failed");
  const confirm = answerLeaveGuard(false);

  await act(async () => {
    void router.navigate("/a?tab=events");
    void router.navigate("/b");
  });

  expect(confirm).toHaveBeenCalledTimes(1);
  expect(router.state.location.pathname).toBe("/a");
});

it("still asks for a dirty page a change of search params kept mounted after another guard blocked its unprompted navigation", async () => {
  let setOtherDirty: (dirty: boolean) => void = () => {};
  const Other = () => {
    const [dirty, setDirty] = useState(true);
    setOtherDirty = setDirty;
    useLeaveGuard(dirty, { allowSamePath: true });
    return null;
  };
  const router = routerWith(
    <>
      <BypassingSamePath />
      <Other />
    </>,
  );
  const confirm = answerLeaveGuard(false);

  await act(async () => navigateUnprompted(() => void router.navigate("/b")));
  expect(router.state.location.pathname).toBe("/a");
  act(() => setOtherDirty(false));
  await act(async () => {
    void router.navigate("/a?tab=events");
    void router.navigate("/b");
  });

  expect(confirm).toHaveBeenCalledTimes(2);
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
