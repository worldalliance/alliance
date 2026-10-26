import { act, render } from "@testing-library/react";
import { expect, it, jest } from "bun:test";
import { createMemoryRouter, RouterProvider } from "react-router";
import AppLayout from "./applayout";
import { AuthContext } from "./lib/AuthContext";
import { authValue } from "./testing/authValue";

it("logs out once when the session is reported ended more than once", () => {
  const logout = jest.fn(() => Promise.resolve());
  const router = createMemoryRouter(
    [
      { path: "/tasks", Component: AppLayout },
      { path: "/login", Component: () => null },
    ],
    { initialEntries: ["/tasks"] },
  );
  render(
    <AuthContext.Provider value={authValue({ loading: true, logout })}>
      <RouterProvider router={router} />
    </AuthContext.Provider>,
  );

  act(() => {
    window.dispatchEvent(new CustomEvent("auth:unauthorized"));
    window.dispatchEvent(new CustomEvent("auth:unauthorized"));
  });

  expect(logout).toHaveBeenCalledTimes(1);
});
