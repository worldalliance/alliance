import { render, screen } from "@testing-library/react";
import { expect, test } from "bun:test";
import {
  createMemoryRouter,
  NavigationType,
  RouterProvider,
  useLocation,
} from "react-router";
import LegacyRedirect from "./LegacyRedirect";

function Where() {
  const { pathname, search, hash } = useLocation();
  return <p>{`${pathname}${search}${hash}`}</p>;
}

test("an old URL lands on its new place with its query and hash", async () => {
  const router = createMemoryRouter(
    [
      { path: "/actions/:actionId", element: <LegacyRedirect /> },
      { path: "/tasks/:actionId", element: <Where /> },
    ],
    { initialEntries: ["/actions/12?tab=events#reminders"] },
  );
  render(<RouterProvider router={router} />);

  expect(
    await screen.findByText("/tasks/12?tab=events#reminders"),
  ).toBeTruthy();
  expect(router.state.historyAction).toBe(NavigationType.Replace);
});
