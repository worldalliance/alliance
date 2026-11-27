import { act, render } from "@testing-library/react";
import { expect, spyOn, test } from "bun:test";
import { useState } from "react";
import {
  createMemoryRouter,
  NavigationType,
  RouterProvider,
  useSearchParams,
} from "react-router";
import LeaveGuard from "../components/LeaveGuard";
import { useLeaveGuard } from "./useLeaveGuard";
import { useSearchParam } from "./useSearchParam";

type Probe = {
  q: ReturnType<typeof useSearchParam>;
  role: ReturnType<typeof useSearchParam>;
  params: URLSearchParams;
  hideExtra: () => void;
};

const slowLoader = () =>
  new Promise((resolve) => setTimeout(resolve, 10, null));

function mount(url: string) {
  let probe: Probe | undefined;
  const Extra = () => {
    useSearchParam("x");
    return null;
  };
  const Probe = () => {
    const [extra, setExtra] = useState(true);
    probe = {
      q: useSearchParam("q"),
      role: useSearchParam("role"),
      params: useSearchParams()[0],
      hideExtra: () => setExtra(false),
    };
    return extra ? <Extra /> : null;
  };
  const router = createMemoryRouter(
    [
      { path: "/", element: <Probe /> },
      { path: "/other", element: <Probe /> },
      { path: "/loaded", loader: slowLoader, element: <Probe /> },
      { path: "/plain", loader: slowLoader, element: <p>Plain</p> },
    ],
    { initialEntries: [url] },
  );
  render(<RouterProvider router={router} />);
  const current = () => {
    if (!probe) throw new Error("not rendered");
    return probe;
  };
  return { current, router };
}

test("sets and removes one param, keeping the others", async () => {
  const { current } = mount("/?view=grid");
  await act(async () => current().q[1]("ada"));
  expect(current().params.toString()).toBe("view=grid&q=ada");
  await act(async () => current().q[1](null));
  expect(current().params.toString()).toBe("view=grid");
});

test("replaces the history entry", async () => {
  const { current, router } = mount("/");
  await act(async () => current().q[1]("a"));
  await act(async () => current().q[1]("ad"));
  expect(router.state.historyAction).toBe(NavigationType.Replace);
});

test("keeps an update made before the previous one rendered", async () => {
  const { current } = mount("/");
  const { q, role } = current();
  await act(async () => {
    q[1]("ada");
    role[1]("staff");
  });
  expect(current().params.toString()).toBe("q=ada&role=staff");
});

test("builds on the rendered URL once earlier updates have rendered", async () => {
  const { current } = mount("/?q=ada");
  await act(async () => current().role[1]("staff"));
  await act(async () => current().q[1](null));
  await act(async () => current().role[1]("admin"));
  expect(current().params.toString()).toBe("role=admin");
});

test("leaves an update unrendered when leaving the page behind", async () => {
  const { current, router } = mount("/");
  await act(async () => {
    current().q[1]("ada");
    await router.navigate("/other");
  });
  await act(async () => current().role[1]("staff"));
  expect(router.state.location.pathname).toBe("/other");
  expect(current().params.toString()).toBe("role=staff");
});

test("drops an update interrupted by leaving for a page without the hook", async () => {
  const { current, router } = mount("/loaded");
  await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
  await act(async () => {
    current().q[1]("ada");
    await router.navigate("/plain");
  });
  expect(router.state.location.pathname).toBe("/plain");
  await act(async () => {
    await router.navigate(-1);
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  expect(router.state.location.search).toBe("");
  await act(async () => {
    current().role[1]("staff");
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  expect(current().params.toString()).toBe("role=staff");
});

test("keeps an unrendered update when one of the page's hooks unmounts", async () => {
  const { current } = mount("/loaded");
  await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
  await act(async () => {
    current().q[1]("ada");
    current().hideExtra();
  });
  await act(async () => {
    current().role[1]("staff");
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  expect(current().params.toString()).toBe("q=ada&role=staff");
});

test("keeps an update in flight when the guard refuses another page with the same search", async () => {
  const { current, router } = mountGuarded(true, "/?q=ada");
  await act(settle);
  const confirm = spyOn(window, "confirm").mockReturnValue(false);
  try {
    await act(async () => {
      current().q[1](null);
      void router.navigate("/other");
    });
    expect(confirm).toHaveBeenCalled();
    await act(async () => {
      current().role[1]("staff");
      await settle();
    });
    expect(current().params.toString()).toBe("role=staff");
  } finally {
    confirm.mockRestore();
  }
});

test("drops a refused update whose search matches another page in flight", async () => {
  const { current, router } = mountGuarded(false, "/?q=ada");
  await act(settle);
  await act(async () => current().setDirty(false));
  const confirm = spyOn(window, "confirm").mockReturnValue(false);
  try {
    await act(async () => {
      void router.navigate("/slow");
      current().setDirty(true);
    });
    expect(router.state.navigation.state).toBe("loading");
    await act(async () => current().q[1](null));
    expect(confirm).toHaveBeenCalled();
    await act(async () => current().setDirty(false));
    await act(async () => {
      current().role[1]("staff");
      await settle();
    });
    expect(router.state.location.pathname).toBe("/");
    expect(current().params.toString()).toBe("q=ada&role=staff");
  } finally {
    confirm.mockRestore();
  }
});

function mountGuarded(allowSamePath: boolean, initialEntry = "/") {
  let probe:
    | {
        q: ReturnType<typeof useSearchParam>;
        role: ReturnType<typeof useSearchParam>;
        setDirty: (dirty: boolean) => void;
        params: URLSearchParams;
      }
    | undefined;
  const Page = () => {
    const [dirty, setDirty] = useState(true);
    useLeaveGuard(dirty, { allowSamePath });
    probe = {
      q: useSearchParam("q"),
      role: useSearchParam("role"),
      setDirty,
      params: useSearchParams()[0],
    };
    return null;
  };
  const router = createMemoryRouter(
    [
      {
        path: "/",
        loader: slowLoader,
        element: (
          <LeaveGuard>
            <Page />
          </LeaveGuard>
        ),
      },
      { path: "/other", element: <p>Other</p> },
      { path: "/slow", loader: slowLoader, element: <p>Slow</p> },
    ],
    { initialEntries: [initialEntry] },
  );
  render(<RouterProvider router={router} />);
  const current = () => {
    if (!probe) throw new Error("not rendered");
    return probe;
  };
  return { current, router };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 30));

test("drops an update the leave guard refused", async () => {
  const { current } = mountGuarded(false);
  await act(settle);
  const confirm = spyOn(window, "confirm").mockReturnValue(false);
  try {
    await act(async () => {
      current().q[1]("ada");
      await settle();
    });
    expect(confirm).toHaveBeenCalled();
    await act(async () => current().setDirty(false));
    await act(async () => {
      current().role[1]("staff");
      await settle();
    });
    expect(current().params.toString()).toBe("role=staff");
  } finally {
    confirm.mockRestore();
  }
});

test("keeps an update in flight when the guard refuses another navigation", async () => {
  const { current, router } = mountGuarded(true);
  await act(settle);
  const confirm = spyOn(window, "confirm").mockReturnValue(false);
  try {
    await act(async () => {
      current().q[1]("ada");
      void router.navigate("/other");
    });
    expect(confirm).toHaveBeenCalled();
    await act(async () => {
      current().role[1]("staff");
      await settle();
    });
    expect(current().params.toString()).toBe("q=ada&role=staff");
  } finally {
    confirm.mockRestore();
  }
});

test("keeps an update in flight when the guard refuses one built on it", async () => {
  const { current, router } = mountGuarded(false);
  await act(settle);
  await act(async () => current().setDirty(false));
  const confirm = spyOn(window, "confirm").mockReturnValue(false);
  try {
    await act(async () => {
      current().q[1]("ada");
      current().setDirty(true);
    });
    expect(router.state.navigation.state).toBe("loading");
    await act(async () => current().role[1]("staff"));
    expect(confirm).toHaveBeenCalled();
    await act(async () => current().setDirty(false));
    await act(async () => {
      current().role[1]("admin");
      await settle();
    });
    expect(current().params.toString()).toBe("q=ada&role=admin");
  } finally {
    confirm.mockRestore();
  }
});

test("drops every update the leave guard refused together", async () => {
  const { current } = mountGuarded(false);
  await act(settle);
  const confirm = spyOn(window, "confirm").mockReturnValue(false);
  try {
    await act(async () => {
      current().q[1]("ada");
      current().role[1]("staff");
      await settle();
    });
    expect(confirm).toHaveBeenCalled();
    await act(async () => current().setDirty(false));
    await act(async () => {
      current().role[1]("admin");
      await settle();
    });
    expect(current().params.toString()).toBe("role=admin");
  } finally {
    confirm.mockRestore();
  }
});
