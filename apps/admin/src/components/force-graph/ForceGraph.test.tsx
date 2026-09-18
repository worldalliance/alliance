import { cleanup, fireEvent, render } from "@testing-library/react";
import {
  type DrawnGraph,
  ForceGraph,
  type ForceGraphLink,
  type ForceGraphNode,
  type NodeStyle,
} from "./ForceGraph";

afterEach(cleanup);

const NODE_STYLE: NodeStyle = {
  radius: 20,
  fill: "#e5e7eb",
  stroke: "#d1d5db",
  strokeWidth: 1.5,
  glyph: () => "?",
  glyphFontSize: 16,
  glyphColor: "#9ca3af",
  label: null,
};
const nodeStyle = () => NODE_STYLE;

const graphData = () => {
  const nodes: ForceGraphNode[] = ["a", "b", "c"].map((id) => ({
    id,
    displayName: id,
    profilePicture: null,
  }));
  const links: ForceGraphLink<ForceGraphNode>[] = [
    { source: "a", target: "b" },
  ];
  return { nodes, links };
};

interface StyleCall {
  selectedId: string | null;
  attached: boolean;
}

const recordStyles =
  (calls: StyleCall[]) =>
  (graph: DrawnGraph<ForceGraphNode>, selectedId: string | null) => {
    calls.push({
      selectedId,
      attached: graph.node.node()?.isConnected ?? false,
    });
  };

const renderGraph = () => {
  const calls: StyleCall[] = [];
  const data = graphData();
  const view = render(
    <ForceGraph
      nodes={data.nodes}
      links={data.links}
      nodeStyle={nodeStyle}
      chargeStrength={-120}
      applyStyles={recordStyles(calls)}
    />,
  );
  const drawnNode = (id: string) => {
    const node = view.getByText(id, { selector: "title" }).parentElement;
    if (!node) throw new Error(`node ${id} is not drawn`);
    return node;
  };
  const lastSelected = () => calls.at(-1)?.selectedId;
  return { ...view, calls, data, drawnNode, lastSelected };
};

it("styles the graph once it is drawn, with nothing selected", () => {
  const { calls } = renderGraph();

  expect(calls).toEqual([{ selectedId: null, attached: true }]);
});

it("toggles selection by clicking a node", () => {
  const { drawnNode, lastSelected } = renderGraph();

  fireEvent.click(drawnNode("a"));
  expect(lastSelected()).toBe("a");

  fireEvent.click(drawnNode("b"));
  expect(lastSelected()).toBe("b");

  fireEvent.click(drawnNode("b"));
  expect(lastSelected()).toBeNull();
});

it("clears selection on a background click", () => {
  const { container, drawnNode, lastSelected } = renderGraph();

  fireEvent.click(drawnNode("a"));
  const svg = container.querySelector("svg");
  if (!svg) throw new Error("no svg");
  fireEvent.click(svg);

  expect(lastSelected()).toBeNull();
});

it("restyles with a new applyStyles and keeps the selection", () => {
  const { data, drawnNode, rerender } = renderGraph();
  fireEvent.click(drawnNode("a"));

  const calls: StyleCall[] = [];
  rerender(
    <ForceGraph
      nodes={data.nodes}
      links={data.links}
      nodeStyle={nodeStyle}
      chargeStrength={-120}
      applyStyles={recordStyles(calls)}
    />,
  );

  expect(calls).toEqual([{ selectedId: "a", attached: true }]);
});

it("redraws new data and clears the selection", () => {
  const { container, drawnNode, rerender, calls } = renderGraph();
  fireEvent.click(drawnNode("a"));

  const data = graphData();
  rerender(
    <ForceGraph
      nodes={data.nodes}
      links={data.links}
      nodeStyle={nodeStyle}
      chargeStrength={-120}
      applyStyles={recordStyles(calls)}
    />,
  );

  expect(container.querySelectorAll("title")).toHaveLength(3);
  expect(calls.at(-1)).toEqual({ selectedId: null, attached: true });
});
