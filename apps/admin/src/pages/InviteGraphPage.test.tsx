import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import {
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

serveApi(
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

const renderPage = async () => {
  const view = render(<InviteGraphPage />);
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
