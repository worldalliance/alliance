import type { UserDto } from "@alliance/shared/client";
import { act, render, screen } from "@testing-library/react";
import { afterEach, expect, it, jest } from "bun:test";
import { createMemoryRouter, RouterProvider, useLocation } from "react-router";
import AppLayout from "./applayout";
import { AuthContext } from "./lib/AuthContext";
import { deferPhoneStep, phoneStepHref } from "./onboarding/flow";
import { testAuthUser } from "./stories/testData";
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

const Where = () => {
  const location = useLocation();
  return (
    <div data-testid="where">{`${location.pathname}${location.search}`}</div>
  );
};

const openAs = (
  path: string,
  {
    user,
    isImpersonation = false,
  }: { user: UserDto; isImpersonation?: boolean },
) => {
  const router = createMemoryRouter(
    [
      {
        Component: AppLayout,
        children: [
          { path: "/tasks", Component: Where },
          { path: "/deleteaccount", Component: Where },
        ],
      },
      { path: "/onboarding", Component: Where },
    ],
    { initialEntries: [path] },
  );
  render(
    <AuthContext.Provider value={authValue({ user, isImpersonation })}>
      <RouterProvider router={router} />
    </AuthContext.Provider>,
  );
  return screen.getByTestId("where").textContent;
};

const signed = { ...testAuthUser, hasActiveContract: true };

it("sends a signed member with no phone number to the phone step, then back", () => {
  expect(openAs("/tasks?x=1#done", { user: signed })).toBe(
    phoneStepHref("/tasks?x=1#done"),
  );
});

it.each([
  [
    "a member with a number",
    "/tasks",
    { user: { ...signed, phoneNumber: "+14155552671" } },
  ],
  ["a member who hasn't signed", "/tasks", { user: testAuthUser }],
  ["an admin impersonating", "/tasks", { user: signed, isImpersonation: true }],
  ["account deletion", "/deleteaccount", { user: signed }],
])("lets %s through", (_who, path, as) => {
  expect(openAs(path, as)).toBe(path);
});

afterEach(() => sessionStorage.clear());

it("lets a member who continued without a number through for the rest of the visit", () => {
  deferPhoneStep(signed.id);
  expect(openAs("/tasks", { user: signed })).toBe("/tasks");
});

it("still sends a member to the phone step when another account continued without one", () => {
  deferPhoneStep(signed.id + 1);
  expect(openAs("/tasks", { user: signed })).toBe(phoneStepHref("/tasks"));
});
