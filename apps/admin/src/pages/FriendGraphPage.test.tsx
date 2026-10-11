import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { focusManager, onlineManager } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  drawnCircleStroke,
  drawnLinks,
  drawnNode,
  user,
} from "../components/force-graph/graphTesting";
import FriendGraphPage from "./FriendGraphPage";

afterEach(cleanup);

const api = serveApi(
  routes({
    "GET /user/list-graph": () =>
      Response.json([
        user({ id: 1, name: "ada" }),
        user({ id: 2, name: "sam" }),
        user({ id: 3, name: "ren" }),
        user({ id: 4, name: "lee" }),
      ]),
    "GET /user/friends/graphEdges": () =>
      Response.json([
        { userAId: 1, userBId: 2 },
        { userAId: 3, userBId: 2 },
        { userAId: 3, userBId: 4 },
      ]),
  }),
);

it("highlights the selected member and their direct friends", async () => {
  const { container } = render(<FriendGraphPage />, queryWrapper());
  await waitFor(() => drawnNode(container, "sam"));

  fireEvent.click(drawnNode(container, "sam"));

  expect(drawnCircleStroke(container, "sam")).toBe("#3b82f6");
  expect(drawnCircleStroke(container, "ada")).toBe("#60a5fa");
  expect(drawnCircleStroke(container, "ren")).toBe("#60a5fa");
  expect(drawnCircleStroke(container, "lee")).toBe("#d1d5db");
  const strokes = Object.fromEntries(
    Array.from(drawnLinks(container), ([name, line]) => [
      name,
      line.getAttribute("stroke"),
    ]),
  );
  expect(strokes).toEqual({
    "ada->sam": "#3b82f6",
    "ren->sam": "#3b82f6",
    "ren->lee": "#ccc",
  });
});

it("names the users when they fail to load", async () => {
  api.alsoServing({
    "GET /user/list-graph": () => Response.json({}, { status: 500 }),
  });
  render(<FriendGraphPage />, queryWrapper());

  expect(
    await screen.findByText("Could not load users.", { exact: false }),
  ).toBeTruthy();
});

it("names the friendships when they fail to load", async () => {
  api.alsoServing({
    "GET /user/friends/graphEdges": () => Response.json({}, { status: 500 }),
  });
  render(<FriendGraphPage />, queryWrapper());

  expect(
    await screen.findByText("Could not load friendships.", { exact: false }),
  ).toBeTruthy();
});

it("waits for a fresh user list before drawing cached users", async () => {
  let release = () => {};
  const usersGate = new Promise<void>((resolve) => (release = resolve));
  api.alsoServing({
    "GET /user/list-graph": async () => {
      await usersGate;
      return Response.json([user({ id: 1, name: "ada" })]);
    },
  });
  const query = queryWrapper();
  query.client.setQueryData(queryKeys.graphUsersAdmin(), [
    user({ id: 2, name: "sam" }),
  ]);

  const view = render(<FriendGraphPage />, query);
  await act(async () => {});
  expect(screen.getByText("Loading graph...")).toBeTruthy();

  release();
  await waitFor(() => drawnNode(view.container, "ada"));
  expect(() => drawnNode(view.container, "sam")).toThrow();
});

it.each([
  [
    "the window regains focus",
    (on: boolean) => focusManager.setFocused(on),
    () => focusManager.setFocused(undefined),
  ],
  [
    "the network reconnects",
    (on: boolean) => onlineManager.setOnline(on),
    () => onlineManager.setOnline(true),
  ],
])("keeps its users when %s", async (_event, toggle, reset) => {
  let userLoads = 0;
  api.alsoServing({
    "GET /user/list-graph": () => {
      userLoads += 1;
      return Response.json([user({ id: 1, name: "ada" })]);
    },
  });
  const { container } = render(<FriendGraphPage />, queryWrapper());
  await waitFor(() => drawnNode(container, "ada"));

  act(() => {
    toggle(false);
    toggle(true);
  });
  await act(async () => {});
  reset();

  expect(userLoads).toBe(1);
});
