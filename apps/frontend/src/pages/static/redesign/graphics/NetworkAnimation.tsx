import { cn } from "@alliance/shared/styles/util";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePrefersReducedMotion } from "../hooks";

/** Edge length at desktop width; narrow canvases scale it down. */
const STEP_BASE = 108;
const STEP_MIN = 62;

/** Keeps roughly the same node count per screen instead of a few huge cells. */
function stepFor(width: number) {
  return Math.max(STEP_MIN, Math.min(STEP_BASE, (width / 1440) * STEP_BASE));
}
const LINE = "#c6ccd5";
const FILL = "#ccd2da";
const HUB_SIZE = 42;
const NODE_SIZE = 13;

enum NodeShape {
  Diamond = "diamond",
  Square = "square",
}

type Node = { x: number; y: number; depth: number; shape: NodeShape };
type Edge = { from: number; to: number; depth: number };

/** Four axis steps and four diagonal steps, all of length `step`. */
function directionsFor(step: number) {
  const diagonal = step / Math.SQRT2;
  return [
    { dx: step, dy: 0 },
    { dx: -step, dy: 0 },
    { dx: 0, dy: step },
    { dx: 0, dy: -step },
    { dx: diagonal, dy: diagonal },
    { dx: diagonal, dy: -diagonal },
    { dx: -diagonal, dy: diagonal },
    { dx: -diagonal, dy: -diagonal },
  ];
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function cross(ax: number, ay: number, bx: number, by: number) {
  return ax * by - ay * bx;
}

/** True when the open segments properly cross, ignoring shared endpoints. */
function segmentsCross(
  a1: { x: number; y: number },
  a2: { x: number; y: number },
  b1: { x: number; y: number },
  b2: { x: number; y: number },
) {
  const d1x = a2.x - a1.x;
  const d1y = a2.y - a1.y;
  const d2x = b2.x - b1.x;
  const d2y = b2.y - b1.y;
  const denominator = cross(d1x, d1y, d2x, d2y);
  if (Math.abs(denominator) < 1e-9) return false;

  const t = cross(b1.x - a1.x, b1.y - a1.y, d2x, d2y) / denominator;
  const u = cross(b1.x - a1.x, b1.y - a1.y, d1x, d1y) / denominator;
  const inside = (v: number) => v > 1e-6 && v < 1 - 1e-6;
  return inside(t) && inside(u);
}

/**
 * Grows a tree of equal-length edges outward from the hub, breadth-first so
 * `depth` drives the reveal. Candidate edges are rejected when they would cross
 * an existing edge or land on top of another node, so the lattice stays legible.
 */
function buildNetwork(params: {
  width: number;
  height: number;
  hubX: number;
  hubY: number;
  seed: number;
}) {
  const { width, height, hubX, hubY, seed } = params;
  const random = mulberry32(seed);
  const step = stepFor(width);
  const directions = directionsFor(step);
  const nodes: Node[] = [
    { x: hubX, y: hubY, depth: 0, shape: NodeShape.Square },
  ];
  const edges: Edge[] = [];

  const tooClose = (x: number, y: number) =>
    nodes.some((n) => Math.hypot(n.x - x, n.y - y) < step * 0.92);

  const margin = step * 0.5;
  let frontier = [0];
  // Deep enough for branches to reach the far edges of a wide hero.
  const maxDepth = 26;

  for (let depth = 1; depth <= maxDepth; depth++) {
    const next: number[] = [];

    for (const parentId of frontier) {
      const parent = nodes[parentId];
      // The first ring fans out in every direction so growth stays balanced.
      const branches = depth === 1 ? 8 : random() < 0.62 ? 2 : 1;
      const order = directions.map((_, i) => i).sort(() => random() - 0.5);
      let placed = 0;

      for (const dirIndex of order) {
        if (placed >= branches) break;
        const { dx, dy } = directions[dirIndex];
        const x = parent.x + dx;
        const y = parent.y + dy;

        if (x < -margin || x > width + margin) continue;
        if (y < -margin || y > height + margin) continue;
        if (tooClose(x, y)) continue;

        const candidate = { x, y };
        const crosses = edges.some((e) =>
          segmentsCross(parent, candidate, nodes[e.from], nodes[e.to]),
        );
        if (crosses) continue;

        nodes.push({
          x,
          y,
          depth,
          shape: random() < 0.45 ? NodeShape.Square : NodeShape.Diamond,
        });
        edges.push({ from: parentId, to: nodes.length - 1, depth });
        next.push(nodes.length - 1);
        placed += 1;
      }
    }

    frontier = next;
    if (frontier.length === 0) break;
  }

  return { nodes, edges, step };
}

function NodeGlyph({
  node,
  isHub,
  scale,
}: {
  node: Node;
  isHub: boolean;
  scale: number;
}) {
  const size = (isHub ? HUB_SIZE : NODE_SIZE) * scale;
  const gap = (isHub ? 9 : 4.5) * scale;
  const rotation = node.shape === NodeShape.Diamond ? 45 : 0;
  const radius = (isHub ? 6 : 3) * scale;
  const rings = isHub ? [1, 2] : [1];

  return (
    <g transform={`translate(${node.x} ${node.y}) rotate(${rotation})`}>
      <rect
        x={-size / 2}
        y={-size / 2}
        width={size}
        height={size}
        rx={radius}
        fill={FILL}
      />
      {rings.map((ring) => (
        <rect
          key={ring}
          x={-size / 2 - gap * ring}
          y={-size / 2 - gap * ring}
          width={size + gap * ring * 2}
          height={size + gap * ring * 2}
          rx={radius + gap * ring * 0.6}
          fill="none"
          stroke={LINE}
          strokeWidth={isHub ? 2 : 1.4}
        />
      ))}
    </g>
  );
}

const FALLBACK = { width: 1440, height: 620 };

/**
 * The lattice from `design/network-animation.png`. Measured in real pixels so
 * the hub can be pinned under the hero copy rather than wherever a viewBox crop
 * happens to put it.
 */
export function NetworkAnimation({
  className,
  hubXFraction = 0.5,
  hubYFraction = 0.62,
  seed = 11,
}: {
  className?: string;
  hubXFraction?: number;
  hubYFraction?: number;
  seed?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(FALLBACK);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width < 1 || height < 1) return;
      // Round so a scrollbar appearing doesn't rebuild the whole lattice.
      setSize({
        width: Math.round(width / 40) * 40,
        height: Math.round(height / 40) * 40,
      });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { nodes, edges, step } = useMemo(
    () =>
      buildNetwork({
        width: size.width,
        height: size.height,
        hubX: size.width * hubXFraction,
        hubY: size.height * hubYFraction,
        seed,
      }),
    [size.width, size.height, hubXFraction, hubYFraction, seed],
  );

  const maxDepth = nodes.reduce((m, n) => Math.max(m, n.depth), 0);
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    if (reduced) {
      setRevealed(maxDepth);
      return;
    }
    if (revealed >= maxDepth) return;
    const id = setTimeout(
      () => setRevealed((d) => d + 1),
      revealed === 0 ? 380 : 320,
    );
    return () => clearTimeout(id);
  }, [revealed, maxDepth, reduced]);

  const settled = revealed >= maxDepth;

  return (
    <div
      ref={containerRef}
      className={cn("pointer-events-none", className)}
      style={{
        opacity: settled ? 0.55 : 1,
        transition: "opacity 1400ms ease-out",
      }}
    >
      <svg
        className="size-full"
        viewBox={`0 0 ${size.width} ${size.height}`}
        aria-hidden
      >
        {edges.map((edge) => {
          const from = nodes[edge.from];
          const to = nodes[edge.to];
          const on = edge.depth <= revealed;
          return (
            <line
              key={`${edge.from}-${edge.to}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={LINE}
              strokeWidth={1.2}
              style={{
                opacity: on ? 1 : 0,
                transition: "opacity 900ms ease-out",
              }}
            />
          );
        })}
        {nodes.map((node, i) => {
          const on = node.depth <= revealed;
          return (
            <g
              key={i}
              style={{
                opacity: on ? 1 : 0,
                transform: on ? "scale(1)" : "scale(0.4)",
                transformOrigin: `${node.x}px ${node.y}px`,
                transition: "opacity 700ms ease-out, transform 700ms ease-out",
                transitionDelay: "120ms",
              }}
            >
              <NodeGlyph
                node={node}
                isHub={node.depth === 0}
                scale={Math.max(0.7, step / STEP_BASE)}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
