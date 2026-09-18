import type { Selection, SimulationLinkDatum, SimulationNodeDatum } from "d3";
import {
  drag,
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  select,
  zoom,
  zoomIdentity,
} from "d3";
import { type ReactNode, useLayoutEffect, useRef, useState } from "react";

export interface ForceGraphNode extends SimulationNodeDatum {
  id: string;
  displayName: string;
  profilePicture: string | null;
}

export interface ForceGraphLink<
  N extends ForceGraphNode,
> extends SimulationLinkDatum<N> {
  source: string | N;
  target: string | N;
}

export interface NodeStyle {
  radius: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  /** Drawn inside the circle when the node has no picture. */
  glyph: (node: ForceGraphNode) => string;
  glyphFontSize: number;
  glyphColor: string;
  /** How the display name is drawn under the circle; null draws no name. */
  label: { color: string; weight: string } | null;
}

export interface DrawnGraph<N extends ForceGraphNode> {
  node: Selection<SVGGElement, N, SVGGElement, unknown>;
  link: Selection<SVGLineElement, ForceGraphLink<N>, SVGGElement, unknown>;
}

/** forceLink swaps each id for its node when the simulation starts. */
export function linkEnd<N extends ForceGraphNode>(end: string | N): N {
  if (typeof end === "string") {
    throw new Error(`link end ${end} was never resolved to a node`);
  }
  return end;
}

interface ForceGraphProps<N extends ForceGraphNode> {
  /** Keep nodes, links, and nodeStyle stable: a new one rebuilds the graph. */
  nodes: N[];
  links: ForceGraphLink<N>[];
  nodeStyle: (node: N) => NodeStyle;
  /** Negative repels. */
  chargeStrength: number;
  /** Restyles the drawn graph; runs after every build and selection change. */
  applyStyles: (graph: DrawnGraph<N>, selectedId: string | null) => void;
  /** Extra SVG defs, e.g. markers that applyStyles references. */
  defs?: ReactNode;
}

const PREWARM_TICKS = 500;
const NODE_COLLISION_RADIUS = 25;

export const ForceGraph = <N extends ForceGraphNode>({
  nodes,
  links,
  nodeStyle,
  chargeStrength,
  applyStyles,
  defs,
}: ForceGraphProps<N>) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const layerRef = useRef<SVGGElement>(null);
  const [graph, setGraph] = useState<DrawnGraph<N> | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Layout effects, so the graph is styled before the browser first paints it.
  useLayoutEffect(() => {
    if (!svgRef.current || !layerRef.current) return;

    const svg = select(svgRef.current);
    const layer = select(layerRef.current);
    layer.selectAll("*").remove();

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    const patterns = layer.append("defs");
    for (const node of nodes) {
      if (node.profilePicture) {
        const size = nodeStyle(node).radius * 2;
        patterns
          .append("pattern")
          .attr("id", `pfp-${node.id}`)
          .attr("width", 1)
          .attr("height", 1)
          .append("image")
          .attr("href", node.profilePicture)
          .attr("width", size)
          .attr("height", size)
          .attr("preserveAspectRatio", "xMidYMid slice");
      }
    }

    const g = layer.append("g");

    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoomBehavior);

    const simulation = forceSimulation<N>(nodes)
      .force(
        "link",
        forceLink<N, ForceGraphLink<N>>(links)
          .id((d) => d.id)
          .distance(60),
      )
      .force("charge", forceManyBody().strength(chargeStrength))
      .force("center", forceCenter(width / 2, height / 2))
      .force("collision", forceCollide().radius(NODE_COLLISION_RADIUS))
      .stop();

    for (let i = 0; i < PREWARM_TICKS; i++) simulation.tick();

    const link = g
      .append("g")
      .selectAll<SVGLineElement, ForceGraphLink<N>>("line")
      .data(links)
      .join("line")
      .attr("stroke", "#ccc")
      .attr("stroke-width", 1.5)
      .attr("stroke-opacity", 0.6);

    const node = g
      .append("g")
      .selectAll<SVGGElement, N>("g")
      .data(nodes)
      .join("g")
      .attr("cursor", "pointer");

    node
      .append("circle")
      .attr("r", (d) => nodeStyle(d).radius)
      .attr("fill", (d) =>
        d.profilePicture ? `url(#pfp-${d.id})` : nodeStyle(d).fill,
      )
      .attr("stroke", (d) => nodeStyle(d).stroke)
      .attr("stroke-width", (d) => nodeStyle(d).strokeWidth);

    node
      .filter((d) => !d.profilePicture)
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("font-size", (d) => nodeStyle(d).glyphFontSize)
      .attr("font-weight", "bold")
      .attr("fill", (d) => nodeStyle(d).glyphColor)
      .text((d) => nodeStyle(d).glyph(d));

    node
      .filter((d) => nodeStyle(d).label !== null)
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", (d) => nodeStyle(d).radius + 14)
      .attr("font-size", 10)
      .attr("font-weight", (d) => nodeStyle(d).label?.weight ?? null)
      .attr("fill", (d) => nodeStyle(d).label?.color ?? null)
      .text((d) => d.displayName);

    const dragBehavior = drag<SVGGElement, N>()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    node.call(dragBehavior);

    node.on("click", (event, d) => {
      event.stopPropagation();
      setSelectedId((current) => (current === d.id ? null : d.id));
    });

    svg.on("click", () => setSelectedId(null));

    node.append("title").text((d) => d.displayName);

    function updatePositions() {
      link
        .attr("x1", (d) => linkEnd(d.source).x ?? 0)
        .attr("y1", (d) => linkEnd(d.source).y ?? 0)
        .attr("x2", (d) => linkEnd(d.target).x ?? 0)
        .attr("y2", (d) => linkEnd(d.target).y ?? 0);

      node.attr("transform", (d) => `translate(${d.x},${d.y})`);
    }

    updatePositions();

    simulation.on("tick", updatePositions).restart();

    svg.call(
      zoomBehavior.transform,
      zoomIdentity
        .translate(width / 2, height / 2)
        .scale(0.8)
        .translate(-width / 2, -height / 2),
    );

    setSelectedId(null);
    setGraph({ node, link });

    return () => {
      simulation.stop();
      setGraph(null);
    };
  }, [nodes, links, nodeStyle, chargeStrength]);

  useLayoutEffect(() => {
    if (graph) applyStyles(graph, selectedId);
  }, [graph, applyStyles, selectedId]);

  return (
    <svg ref={svgRef} className="flex-1 w-full min-h-0">
      {defs && <defs>{defs}</defs>}
      <g ref={layerRef} />
    </svg>
  );
};
