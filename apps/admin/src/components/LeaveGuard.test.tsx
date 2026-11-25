import { act, fireEvent, render, screen } from "@testing-library/react";
import { expect, it, jest } from "bun:test";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router";
import { useLeaveGuard } from "../lib/useLeaveGuard";
import LeaveGuard from "./LeaveGuard";

const Dirty = () => {
  useLeaveGuard(true);
  return <button>Edit</button>;
};

const leaveDirtyPage = async () => {
  const router = createMemoryRouter(
    [
      {
        element: (
          <LeaveGuard>
            <Outlet />
          </LeaveGuard>
        ),
        children: [
          { path: "/a", element: <Dirty /> },
          { path: "/b", element: null },
        ],
      },
    ],
    { initialEntries: ["/a"] },
  );
  render(<RouterProvider router={router} />);
  await act(() => router.navigate("/b"));
  return router;
};

const dialog = () =>
  screen.queryByRole("dialog", { name: "Discard unsaved changes?" });
const press = (name: string) =>
  act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });

it("asks in the admin's dialog, never the browser's", async () => {
  const browser = jest.spyOn(window, "confirm").mockReturnValue(true);
  try {
    const router = await leaveDirtyPage();

    expect(dialog()).toBeTruthy();
    expect(
      screen.getByText("Leaving now loses the changes you haven't saved."),
    ).toBeTruthy();
    expect(browser).not.toHaveBeenCalled();
    expect(router.state.location.pathname).toBe("/a");
  } finally {
    browser.mockRestore();
  }
});

it("stays, with the dialog closed, on Keep editing", async () => {
  const router = await leaveDirtyPage();

  await press("Keep editing");

  expect(router.state.location.pathname).toBe("/a");
  expect(dialog()).toBeNull();
});

it("stays on Escape", async () => {
  const router = await leaveDirtyPage();

  await act(async () => {
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  });

  expect(router.state.location.pathname).toBe("/a");
  expect(dialog()).toBeNull();
});

it("doesn't leave on Enter, which would discard the changes unread", async () => {
  const router = await leaveDirtyPage();

  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Enter" });

  expect(router.state.location.pathname).toBe("/a");
  expect(dialog()).toBeTruthy();
});

it("leaves on Discard changes", async () => {
  const router = await leaveDirtyPage();

  await press("Discard changes");

  expect(router.state.location.pathname).toBe("/b");
  expect(dialog()).toBeNull();
});

it("asks again the next time staff try to leave", async () => {
  const router = await leaveDirtyPage();
  await press("Keep editing");

  await act(() => router.navigate("/b"));

  expect(dialog()).toBeTruthy();
});
