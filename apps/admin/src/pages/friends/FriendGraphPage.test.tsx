import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { focusManager, onlineManager } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import {
  drawnCircleStroke,
  drawnLinks,
  drawnNode,
  user,
} from "../../components/force-graph/graphTesting";
import { graphColor, NODE_STYLE } from "./friendGraph";
import FriendGraphPage from "./FriendGraphPage";

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

const renderPage = (query = queryWrapper()) =>
  render(
    <MemoryRouter initialEntries={["/members/friends"]}>
      <FriendGraphPage />
    </MemoryRouter>,
    query,
  );

/** The graph's pane, so a banner's icon isn't read as a friendship. */
const canvasOf = (container: HTMLElement) => {
  const pane = container.querySelector("svg:not(.lucide)")?.parentElement;
  if (!(pane instanceof HTMLElement)) throw new Error("no graph drawn");
  return pane;
};

it("highlights the selected member and their direct friends", async () => {
  const { container } = renderPage();
  await waitFor(() => drawnNode(container, "sam"));

  fireEvent.click(drawnNode(container, "sam"));

  expect(drawnCircleStroke(container, "sam")).toBe(graphColor.selected);
  expect(
    drawnNode(container, "sam")
      .querySelector("circle")
      ?.getAttribute("stroke-width"),
  ).toBe("3");
  expect(drawnCircleStroke(container, "ada")).toBe(graphColor.selected);
  expect(drawnCircleStroke(container, "ren")).toBe(graphColor.selected);
  expect(drawnCircleStroke(container, "lee")).toBe(NODE_STYLE.stroke);
  const strokes = Object.fromEntries(
    Array.from(drawnLinks(container), ([name, line]) => [
      name,
      line.getAttribute("stroke"),
    ]),
  );
  expect(strokes).toEqual({
    "ada->sam": graphColor.selected,
    "ren->sam": graphColor.selected,
    "ren->lee": graphColor.edge,
  });
});

it("names the members when they fail to load", async () => {
  api.alsoServing({
    "GET /user/list-graph": () => Response.json({}, { status: 500 }),
  });
  renderPage();

  expect(await screen.findByText("Couldn't load members")).toBeTruthy();
});

it("names the friendships when they fail to load", async () => {
  api.alsoServing({
    "GET /user/friends/graphEdges": () => Response.json({}, { status: 500 }),
  });
  renderPage();

  expect(
    await screen.findByText("Couldn't load friendships.", { exact: false }),
  ).toBeTruthy();
  expect(screen.getByText("4 members with an active contract")).toBeTruthy();
  expect(screen.queryByText("—", { exact: false })).toBeNull();
});

it("retries members and friendships from one place when both fail on first load", async () => {
  let userLoads = 0;
  let edgeLoads = 0;
  api.alsoServing({
    "GET /user/list-graph": () => {
      userLoads += 1;
      return Response.json({}, { status: 500 });
    },
    "GET /user/friends/graphEdges": () => {
      edgeLoads += 1;
      return Response.json({}, { status: 500 });
    },
  });
  renderPage();

  expect(
    await screen.findByText("Couldn't load members or friendships"),
  ).toBeTruthy();
  expect(
    screen.queryByText("The graph is incomplete.", { exact: false }),
  ).toBeNull();
  const retries = screen.getAllByRole("button", { name: "Try again" });
  expect(retries).toHaveLength(1);

  const before = { userLoads, edgeLoads };
  fireEvent.click(retries[0]);

  await waitFor(() => {
    expect(userLoads).toBe(before.userLoads + 1);
    expect(edgeLoads).toBe(before.edgeLoads + 1);
  });
});

it("draws no cached friendships once a reload of them fails", async () => {
  api.alsoServing({
    "GET /user/friends/graphEdges": () => Response.json({}, { status: 500 }),
  });
  const query = queryWrapper();
  query.client.setQueryData(queryKeys.friendGraphEdgesAdmin(), [
    { userAId: 1, userBId: 2 },
  ]);

  const view = renderPage(query);

  await screen.findByText("Couldn't load friendships.", { exact: false });
  expect(drawnLinks(canvasOf(view.container)).size).toBe(0);
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

  const view = renderPage(query);
  await act(async () => {});
  expect(screen.getByRole("status", { name: "Loading" })).toBeTruthy();

  release();
  await waitFor(() => drawnNode(view.container, "ada"));
  expect(() => drawnNode(view.container, "sam")).toThrow();
});

it("waits for a fresh friendship list before drawing cached friendships", async () => {
  let release = () => {};
  const edgesGate = new Promise<void>((resolve) => (release = resolve));
  api.alsoServing({
    "GET /user/friends/graphEdges": async () => {
      await edgesGate;
      return Response.json([{ userAId: 3, userBId: 4 }]);
    },
  });
  const query = queryWrapper();
  query.client.setQueryData(queryKeys.friendGraphEdgesAdmin(), [
    { userAId: 1, userBId: 2 },
  ]);

  const view = renderPage(query);
  await waitFor(() =>
    expect(query.client.getQueryData(queryKeys.graphUsersAdmin())).toBeTruthy(),
  );
  expect(screen.getByRole("status", { name: "Loading" })).toBeTruthy();

  release();
  await waitFor(() => drawnNode(view.container, "ren"));
  expect([...drawnLinks(canvasOf(view.container)).keys()]).toEqual([
    "ren->lee",
  ]);
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
])("keeps its users and friendships when %s", async (_event, toggle, reset) => {
  let userLoads = 0;
  let edgeLoads = 0;
  api.alsoServing({
    "GET /user/list-graph": () => {
      userLoads += 1;
      return Response.json([user({ id: 1, name: "ada" })]);
    },
    "GET /user/friends/graphEdges": () => {
      edgeLoads += 1;
      return Response.json([]);
    },
  });
  const { container } = renderPage();
  await waitFor(() => drawnNode(container, "ada"));

  act(() => {
    toggle(false);
    toggle(true);
  });
  await act(async () => {});
  reset();

  expect(userLoads).toBe(1);
  expect(edgeLoads).toBe(1);
});
