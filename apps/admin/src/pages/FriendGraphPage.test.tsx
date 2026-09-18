import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import {
  drawnCircleStroke,
  drawnLinks,
  drawnNode,
  user,
} from "../components/force-graph/graphTesting";
import FriendGraphPage from "./FriendGraphPage";

afterEach(cleanup);

serveApi(
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
  const { container } = render(<FriendGraphPage />);
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
