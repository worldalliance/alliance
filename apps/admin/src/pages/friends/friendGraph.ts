import { publicDisplayName } from "@alliance/common/displayName";
import type {
  FriendGraphEdgeDto,
  UserDto,
} from "@alliance/shared/client/types.gen";
import type {
  ForceGraphLink,
  ForceGraphNode,
  NodeStyle,
} from "../../components/force-graph/ForceGraph";
import { chartColor } from "../../ui/charts/chartColor";

export interface GraphNode extends ForceGraphNode {
  userId: number;
}

export type GraphLink = ForceGraphLink<GraphNode>;

export const graphColor = {
  selected: "var(--color-accent)",
  label: "var(--color-fg)",
  glyph: "var(--color-fg-muted)",
  emptyFill: "var(--color-surface-2)",
  edge: chartColor.track,
} as const;

export const NODE_STYLE: NodeStyle = {
  radius: 20,
  fill: graphColor.emptyFill,
  stroke: chartColor.track,
  strokeWidth: 1.5,
  glyph: () => "?",
  glyphFontSize: 16,
  glyphColor: graphColor.glyph,
  label: { color: graphColor.label, weight: "normal" },
};

export const nodeIdOf = (userId: number) => `user-${userId}`;

/**
 * Members with an active contract as nodes, and each friendship between two of
 * them as one link, whichever side its row came from.
 */
export function buildFriendGraph(
  members: readonly UserDto[],
  edges: readonly FriendGraphEdgeDto[],
) {
  const nodes: GraphNode[] = members.map((u) => ({
    id: nodeIdOf(u.id),
    userId: u.id,
    displayName: publicDisplayName(u),
    profilePicture: u.profilePicture,
  }));
  const nodeIds = new Set(nodes.map((n) => n.id));

  const linkKeys = new Set<string>();
  const links: GraphLink[] = [];
  const neighbors = new Map<string, Set<string>>();
  const addNeighbor = (from: string, to: string) => {
    const set = neighbors.get(from) ?? new Set<string>();
    set.add(to);
    neighbors.set(from, set);
  };
  for (const edge of edges) {
    const a = nodeIdOf(edge.userAId);
    const b = nodeIdOf(edge.userBId);
    if (!nodeIds.has(a) || !nodeIds.has(b)) continue;
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (linkKeys.has(key)) continue;
    linkKeys.add(key);
    links.push({ source: a, target: b });
    addNeighbor(a, b);
    addNeighbor(b, a);
  }
  return { nodes, links, neighbors };
}
