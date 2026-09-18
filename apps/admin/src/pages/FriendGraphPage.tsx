import {
  FriendGraphEdgeDto,
  UserDto,
  userGetFriendGraphEdgesAdmin,
  userListForGraphAdmin,
} from "@alliance/shared/client";
import { AlertTriangle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type DrawnGraph,
  ForceGraph,
  type ForceGraphLink,
  type ForceGraphNode,
  linkEnd,
  type NodeStyle,
} from "../components/force-graph/ForceGraph";
import {
  UserGraphFilterControls,
  useUserGraphFilters,
} from "../components/force-graph/UserGraphFilters";

interface GraphNode extends ForceGraphNode {
  userId: number;
}

type GraphLink = ForceGraphLink<GraphNode>;

const DEFAULT_SPREAD = 120;
const MIN_SPREAD = 20;
const MAX_SPREAD = 800;
const NODE_STYLE: NodeStyle = {
  radius: 20,
  fill: "#e5e7eb",
  stroke: "#d1d5db",
  strokeWidth: 1.5,
  glyph: () => "?",
  glyphFontSize: 16,
  glyphColor: "#9ca3af",
  label: { color: "#374151", weight: "normal" },
};
const nodeStyle = () => NODE_STYLE;

const FriendGraphPage = () => {
  const [users, setUsers] = useState<UserDto[]>([]);
  const [friendEdges, setFriendEdges] = useState<FriendGraphEdgeDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [spread, setSpread] = useState(DEFAULT_SPREAD);

  useEffect(() => {
    Promise.all([userListForGraphAdmin(), userGetFriendGraphEdgesAdmin()])
      .then(([usersRes, edgesRes]) => {
        setUsers(usersRes.data ?? []);
        setFriendEdges(edgesRes.data ?? []);

        const failed = [
          { name: "users", error: usersRes.error },
          { name: "friendships", error: edgesRes.error },
        ].filter((request) => request.error !== undefined);

        for (const request of failed) {
          console.error(
            `Friend graph: could not load ${request.name}`,
            request.error,
          );
        }

        setLoadError(
          failed.length > 0
            ? `Could not load ${failed.map((request) => request.name).join(", ")}. The graph below is incomplete.`
            : null,
        );
      })
      .catch(() =>
        setLoadError("Could not load the graph data. Try reloading the page."),
      )
      .finally(() => setLoading(false));
  }, []);

  const activeUsers = useMemo(
    () => users.filter((u) => u.hasActiveContract),
    [users],
  );

  const filters = useUserGraphFilters(activeUsers);

  const filteredUserIds = useMemo(
    () => new Set(activeUsers.filter(filters.matches).map((u) => u.id)),
    [activeUsers, filters.matches],
  );

  const hasActiveFilters = filters.isActive;

  const { nodes, links, neighborMap } = useMemo(() => {
    const userNodeId = (userId: number) => `user-${userId}`;

    const nodes: GraphNode[] = activeUsers.map((u) => ({
      id: userNodeId(u.id),
      userId: u.id,
      displayName: u.anonymous ? "Someone" : u.name,
      profilePicture: u.profilePicture,
    }));
    const nodeIds = new Set(nodes.map((n) => n.id));

    // Friendship is undirected, so a pair is one link regardless of which
    // side the row came from; the key sorts the ids so (a,b) and (b,a) merge.
    const linkSet = new Set<string>();
    const links: GraphLink[] = [];
    const neighborMap = new Map<string, Set<string>>();
    for (const edge of friendEdges) {
      if (edge.userAId === edge.userBId) continue;
      const a = userNodeId(edge.userAId);
      const b = userNodeId(edge.userBId);
      if (!nodeIds.has(a) || !nodeIds.has(b)) continue;
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      if (linkSet.has(key)) continue;
      linkSet.add(key);
      links.push({ source: a, target: b });
      if (!neighborMap.has(a)) neighborMap.set(a, new Set());
      if (!neighborMap.has(b)) neighborMap.set(b, new Set());
      neighborMap.get(a)!.add(b);
      neighborMap.get(b)!.add(a);
    }

    return { nodes, links, neighborMap };
  }, [activeUsers, friendEdges]);

  const applyStyles = useCallback(
    ({ node, link }: DrawnGraph<GraphNode>, selectedId: string | null) => {
      const neighbors = selectedId
        ? (neighborMap.get(selectedId) ?? new Set<string>())
        : new Set<string>();
      const allHighlighted = selectedId
        ? new Set([selectedId, ...neighbors])
        : null;

      const nodePassesFilter = (d: GraphNode) => filteredUserIds.has(d.userId);
      const filterOpacity = (d: GraphNode) =>
        nodePassesFilter(d) || !hasActiveFilters ? 1 : 0.08;

      node
        .select("circle")
        .attr("opacity", filterOpacity)
        .attr("stroke", (d) => {
          if (!allHighlighted) return NODE_STYLE.stroke;
          if (d.id === selectedId) return "#3b82f6";
          if (allHighlighted.has(d.id)) return "#60a5fa";
          return NODE_STYLE.stroke;
        })
        .attr("stroke-width", (d) => {
          if (!allHighlighted) return NODE_STYLE.strokeWidth;
          if (d.id === selectedId) return 3;
          if (allHighlighted.has(d.id)) return 2.5;
          return NODE_STYLE.strokeWidth;
        });

      node
        .selectAll<SVGTextElement, GraphNode>("text")
        .attr("opacity", filterOpacity);

      function linkIsHighlighted(d: GraphLink): boolean {
        if (!allHighlighted || !selectedId) return false;
        const src = linkEnd(d.source).id;
        const tgt = linkEnd(d.target).id;
        return (
          (src === selectedId || allHighlighted.has(src)) &&
          (tgt === selectedId || allHighlighted.has(tgt))
        );
      }

      link
        .attr("stroke", (d) => (linkIsHighlighted(d) ? "#3b82f6" : "#ccc"))
        .attr("stroke-width", (d) => (linkIsHighlighted(d) ? 2.5 : 1.5))
        .attr("stroke-opacity", (d) => {
          if (
            hasActiveFilters &&
            (!nodePassesFilter(linkEnd(d.source)) ||
              !nodePassesFilter(linkEnd(d.target)))
          )
            return 0.05;
          return linkIsHighlighted(d) ? 1 : 0.6;
        });
    },
    [neighborMap, filteredUserIds, hasActiveFilters],
  );

  const matchCount = useMemo(() => {
    if (!hasActiveFilters) return null;
    return activeUsers.filter((u) => filteredUserIds.has(u.id)).length;
  }, [activeUsers, filteredUserIds, hasActiveFilters]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Loading graph...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-screen">
      <div className="p-4 border-b border-gray-200 shrink-0">
        <h2 className="text-lg font-bold">Friend Graph</h2>
        <p className="text-sm text-gray-500">
          {activeUsers.length} members with an active contract,{" "}
          {friendEdges.length} friendships
          {matchCount !== null && ` — ${matchCount} matching filters`}
        </p>
      </div>

      {loadError && (
        <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 shrink-0">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <span>{loadError}</span>
        </div>
      )}

      <div className="px-4 py-2 border-b border-gray-200 shrink-0 flex flex-wrap items-center gap-3 text-sm">
        <UserGraphFilterControls filters={filters} />

        <label className="flex items-center gap-1.5 ml-2">
          <span className="text-xs font-medium text-gray-600">Spread</span>
          <input
            type="range"
            min={MIN_SPREAD}
            max={MAX_SPREAD}
            step={10}
            value={spread}
            onChange={(e) => setSpread(Number(e.target.value))}
            className="w-32"
          />
        </label>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={filters.clear}
            className="text-sm text-zinc-500 hover:text-zinc-700 hover:underline"
          >
            Reset filters
          </button>
        )}
      </div>

      <ForceGraph
        nodes={nodes}
        links={links}
        nodeStyle={nodeStyle}
        chargeStrength={-spread}
        applyStyles={applyStyles}
      />
    </div>
  );
};

export default FriendGraphPage;
