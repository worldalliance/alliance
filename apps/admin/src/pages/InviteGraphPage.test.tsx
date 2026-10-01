import type { CampaignDto } from "@alliance/shared/client";
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
import InviteGraphPage from "./InviteGraphPage";

afterEach(cleanup);

const api = serveApi(
  routes({
    "GET /user/list-graph": () =>
      Response.json([
        user({ id: 1, name: "ada" }),
        user({ id: 2, name: "sam", referredById: 1 }),
        user({ id: 3, name: "ren", referredById: 2 }),
        user({ id: 4, name: "lee", hasActiveContract: false }),
      ]),
    "GET /user/onetimeInvites/graphEdges": () => Response.json([]),
    "GET /campaigns": () => Response.json([]),
  }),
);

const HUB = "No attribution (2)";

const renderPage = async (query = queryWrapper()) => {
  const view = render(<InviteGraphPage />, query);
  await waitFor(() => drawnNode(view.container, "sam"));
  const markerEnds = () =>
    Object.fromEntries(
      Array.from(drawnLinks(view.container), ([name, line]) => [
        name,
        line.getAttribute("marker-end"),
      ]),
    );
  return { ...view, markerEnds };
};

it("draws every link with the plain arrow until a node is selected", async () => {
  const { markerEnds } = await renderPage();

  expect(markerEnds()).toEqual({
    [`${HUB}->ada`]: "url(#arrowhead)",
    "ada->sam": "url(#arrowhead)",
    "sam->ren": "url(#arrowhead)",
    [`${HUB}->lee`]: "url(#arrowhead)",
  });
});

it("tones the selected node's ancestors and descendants", async () => {
  const { container, markerEnds } = await renderPage();

  fireEvent.click(drawnNode(container, "sam"));

  expect(markerEnds()).toEqual({
    [`${HUB}->ada`]: "url(#arrowhead-ancestor)",
    "ada->sam": "url(#arrowhead-ancestor)",
    "sam->ren": "url(#arrowhead-highlight)",
    [`${HUB}->lee`]: "url(#arrowhead)",
  });
  expect(drawnCircleStroke(container, "sam")).toBe("#3b82f6");
  expect(drawnCircleStroke(container, "ada")).toBe("#f59e0b");
  expect(drawnCircleStroke(container, "ren")).toBe("#60a5fa");
  expect(drawnCircleStroke(container, "lee")).toBe("#d1d5db");
});

it("defines every marker a link points at", async () => {
  const { container, markerEnds } = await renderPage();
  fireEvent.click(drawnNode(container, "sam"));

  for (const markerEnd of Object.values(markerEnds())) {
    const id = markerEnd?.match(/^url\(#(.+)\)$/)?.[1];
    expect(id && container.querySelector(`marker[id="${id}"]`)).toBeTruthy();
  }
});

it.each([
  ["all", "4 matching filters"],
  ["inactive", "1 matching filters"],
])("counts members by contract %s", async (contract, expected) => {
  await renderPage();

  fireEvent.change(screen.getByLabelText("Contract", { exact: false }), {
    target: { value: contract },
  });

  expect(screen.getByText(expected, { exact: false })).toBeTruthy();
});

it("counts only active members by default once another filter shows the count", async () => {
  await renderPage();

  fireEvent.change(screen.getByLabelText("Role", { exact: false }), {
    target: { value: "regular" },
  });

  expect(screen.getByText("3 matching filters", { exact: false })).toBeTruthy();
});

it("names the campaigns when they fail to load", async () => {
  api.alsoServing({
    "GET /campaigns": () => Response.json({}, { status: 500 }),
  });
  await renderPage();

  expect(
    screen.getByText("Could not load campaigns.", { exact: false }),
  ).toBeTruthy();
});

const springDrive = {
  id: 9,
  name: "Spring drive",
  code: "spring",
  picture: null,
  kind: "campaign",
  communityId: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
} satisfies CampaignDto;

const withCampaignMember = {
  "GET /user/list-graph": () =>
    Response.json([
      user({ id: 1, name: "ada" }),
      user({ id: 2, name: "sam", referredById: 1 }),
      user({ id: 5, name: "kim", referredByCampaignId: 9 }),
    ]),
};

it("draws cached campaigns and names them when their refetch fails", async () => {
  api.alsoServing({
    ...withCampaignMember,
    "GET /campaigns": () => Response.json({}, { status: 500 }),
  });
  const query = queryWrapper();
  query.client.setQueryData(queryKeys.campaignsAdmin(), [springDrive]);

  const { container } = await renderPage(query);

  expect(drawnNode(container, "Spring drive")).toBeTruthy();
  expect(
    screen.getByText("Could not load campaigns.", { exact: false }),
  ).toBeTruthy();
});

it.each([
  ["none are cached", undefined],
  ["older ones are cached", []],
])("waits for the campaigns before drawing when %s", async (_case, cached) => {
  let release = () => {};
  const campaignsGate = new Promise<void>((resolve) => (release = resolve));
  let usersServed = false;
  api.alsoServing({
    "GET /user/list-graph": () => {
      usersServed = true;
      return withCampaignMember["GET /user/list-graph"]();
    },
    "GET /campaigns": async () => {
      await campaignsGate;
      return Response.json([springDrive]);
    },
  });

  const query = queryWrapper();
  if (cached) query.client.setQueryData(queryKeys.campaignsAdmin(), cached);
  const view = render(<InviteGraphPage />, query);
  await waitFor(() => expect(usersServed).toBe(true));
  await act(async () => {});
  expect(screen.getByText("Loading graph...")).toBeTruthy();

  release();
  await waitFor(() => drawnNode(view.container, "Spring drive"));
  expect(drawnNode(view.container, "No attribution (1)")).toBeTruthy();
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
])("keeps its campaigns when %s", async (_event, toggle, reset) => {
  let campaignLoads = 0;
  api.alsoServing({
    "GET /campaigns": () => {
      campaignLoads += 1;
      return Response.json([]);
    },
  });
  await renderPage();

  act(() => {
    toggle(false);
    toggle(true);
  });
  await act(async () => {});
  reset();

  expect(campaignLoads).toBe(1);
});
