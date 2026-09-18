import {
  FriendGraphEdgeDto,
  UserDto,
  userGetFriendGraphEdgesAdmin,
  userListForGraphAdmin,
} from "@alliance/shared/client";
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
import { AlertTriangle } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface GraphNode extends SimulationNodeDatum {
  id: string;
  userId: number;
  displayName: string;
  profilePicture: string | null;
}

interface GraphLink extends SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
}

type RoleFilter = "all" | "admin" | "staff" | "regular";

interface GraphRefs {
  node: Selection<SVGGElement, GraphNode, SVGGElement, unknown>;
  link: Selection<SVGLineElement, GraphLink, SVGGElement, unknown>;
  getNeighbors: (nodeId: string) => Set<string>;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
}

const NODE_RADIUS = 20;
const DEFAULT_SPREAD = 120;
const MIN_SPREAD = 20;
const MAX_SPREAD = 800;
const NODE_STYLE = {
  fill: "#e5e7eb",
  stroke: "#d1d5db",
  strokeWidth: 1.5,
  glyphColor: "#9ca3af",
  labelColor: "#374151",
};

const FriendGraphPage = () => {
  const svgRef = useRef<SVGSVGElement>(null);
  const graphRef = useRef<GraphRefs | null>(null);
  const [users, setUsers] = useState<UserDto[]>([]);
  const [friendEdges, setFriendEdges] = useState<FriendGraphEdgeDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [communityFilter, setCommunityFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
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

  const availableCommunities = useMemo(() => {
    const map = new Map<number, string>();
    for (const u of activeUsers) {
      for (const c of u.communities ?? []) {
        if (!map.has(c.id)) map.set(c.id, c.name);
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, name]) => ({ id: String(id), name }));
  }, [activeUsers]);

  const availableTags = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of activeUsers) {
      for (const t of u.tags ?? []) {
        if (!map.has(t.id)) map.set(t.id, t.name);
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, name]) => ({ id, name }));
  }, [activeUsers]);

  const filteredUserIds = useMemo(() => {
    const ids = new Set<number>();
    for (const u of activeUsers) {
      if (roleFilter === "admin" && !u.admin) continue;
      if (roleFilter === "staff" && !u.staff) continue;
      if (roleFilter === "regular" && (u.admin || u.staff)) continue;
      if (communityFilter !== "all") {
        const inCommunity = (u.communities ?? []).some(
          (c) => String(c.id) === communityFilter,
        );
        if (!inCommunity) continue;
      }
      if (tagFilter !== "all") {
        const hasTag = (u.tags ?? []).some((t) => t.id === tagFilter);
        if (!hasTag) continue;
      }
      ids.add(u.id);
    }
    return ids;
  }, [activeUsers, roleFilter, communityFilter, tagFilter]);

  const hasActiveFilters =
    roleFilter !== "all" || communityFilter !== "all" || tagFilter !== "all";

  const clearFilters = useCallback(() => {
    setRoleFilter("all");
    setCommunityFilter("all");
    setTagFilter("all");
  }, []);

  useEffect(() => {
    if (loading || !svgRef.current) return;

    const svg = select(svgRef.current);
    svg.selectAll("*").remove();

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

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
    for (const edge of friendEdges) {
      if (edge.userAId === edge.userBId) continue;
      const a = userNodeId(edge.userAId);
      const b = userNodeId(edge.userBId);
      if (!nodeIds.has(a) || !nodeIds.has(b)) continue;
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      if (linkSet.has(key)) continue;
      linkSet.add(key);
      links.push({ source: a, target: b });
    }

    const neighborMap = new Map<string, Set<string>>();
    for (const l of links) {
      const a = typeof l.source === "string" ? l.source : l.source.id;
      const b = typeof l.target === "string" ? l.target : l.target.id;
      if (!neighborMap.has(a)) neighborMap.set(a, new Set());
      if (!neighborMap.has(b)) neighborMap.set(b, new Set());
      neighborMap.get(a)!.add(b);
      neighborMap.get(b)!.add(a);
    }
    function getNeighbors(nodeId: string): Set<string> {
      return neighborMap.get(nodeId) ?? new Set();
    }

    const defs = svg.append("defs");

    for (const node of nodes) {
      if (node.profilePicture) {
        defs
          .append("pattern")
          .attr("id", `pfp-${node.id}`)
          .attr("width", 1)
          .attr("height", 1)
          .append("image")
          .attr("href", node.profilePicture)
          .attr("width", NODE_RADIUS * 2)
          .attr("height", NODE_RADIUS * 2)
          .attr("preserveAspectRatio", "xMidYMid slice");
      }
    }

    const g = svg.append("g");

    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoomBehavior);

    const simulation = forceSimulation<GraphNode>(nodes)
      .force(
        "link",
        forceLink<GraphNode, GraphLink>(links)
          .id((d) => d.id)
          .distance(60),
      )
      .force("charge", forceManyBody().strength(-spread))
      .force("center", forceCenter(width / 2, height / 2))
      .force("collision", forceCollide().radius(NODE_RADIUS + 5))
      .stop();

    const tickCount = 500;
    for (let i = 0; i < tickCount; i++) simulation.tick();

    const link = g
      .append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "#ccc")
      .attr("stroke-width", 1.5)
      .attr("stroke-opacity", 0.6);

    const node = g
      .append("g")
      .selectAll<SVGGElement, GraphNode>("g")
      .data(nodes)
      .join("g")
      .attr("cursor", "pointer");

    node
      .append("circle")
      .attr("r", NODE_RADIUS)
      .attr("fill", (d) =>
        d.profilePicture ? `url(#pfp-${d.id})` : NODE_STYLE.fill,
      )
      .attr("stroke", NODE_STYLE.stroke)
      .attr("stroke-width", NODE_STYLE.strokeWidth);

    node
      .filter((d) => !d.profilePicture)
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("font-size", 16)
      .attr("font-weight", "bold")
      .attr("fill", NODE_STYLE.glyphColor)
      .text("?");

    node
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", NODE_RADIUS + 14)
      .attr("font-size", 10)
      .attr("fill", NODE_STYLE.labelColor)
      .text((d) => d.displayName);

    const dragBehavior = drag<SVGGElement, GraphNode>()
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

    let selectedNodeId: string | null = null;
    graphRef.current = {
      node: node as unknown as GraphRefs["node"],
      link: link as unknown as GraphRefs["link"],
      getNeighbors,
      selectedNodeId: null,
      setSelectedNodeId: (id) => {
        selectedNodeId = id;
        graphRef.current!.selectedNodeId = id;
      },
    };

    node.on("click", (event, d) => {
      event.stopPropagation();
      graphRef.current!.setSelectedNodeId(
        selectedNodeId === d.id ? null : d.id,
      );
      svgRef.current?.dispatchEvent(new CustomEvent("graph-selection-change"));
    });

    svg.on("click", () => {
      graphRef.current!.setSelectedNodeId(null);
      svgRef.current?.dispatchEvent(new CustomEvent("graph-selection-change"));
    });

    node.append("title").text((d) => d.displayName);

    function updatePositions() {
      link
        .attr("x1", (d) => (d.source as GraphNode).x!)
        .attr("y1", (d) => (d.source as GraphNode).y!)
        .attr("x2", (d) => (d.target as GraphNode).x!)
        .attr("y2", (d) => (d.target as GraphNode).y!);

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

    return () => {
      simulation.stop();
      graphRef.current = null;
    };
  }, [loading, activeUsers, friendEdges, spread]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;

    const { node, link, getNeighbors } = graph;

    function nodePassesFilter(d: GraphNode): boolean {
      return filteredUserIds.has(d.userId);
    }

    function applyHighlight() {
      const sid = graphRef.current?.selectedNodeId ?? null;
      const neighbors = sid ? getNeighbors(sid) : new Set<string>();
      const allHighlighted = sid ? new Set([sid, ...neighbors]) : null;

      const filterOpacity = (d: GraphNode) =>
        nodePassesFilter(d) || !hasActiveFilters ? 1 : 0.08;

      node
        .select("circle")
        .attr("opacity", filterOpacity)
        .attr("stroke", (d: GraphNode) => {
          if (!allHighlighted) return NODE_STYLE.stroke;
          if (d.id === sid) return "#3b82f6";
          if (allHighlighted.has(d.id)) return "#60a5fa";
          return NODE_STYLE.stroke;
        })
        .attr("stroke-width", (d: GraphNode) => {
          if (!allHighlighted) return NODE_STYLE.strokeWidth;
          if (d.id === sid) return 3;
          if (allHighlighted.has(d.id)) return 2.5;
          return NODE_STYLE.strokeWidth;
        });

      node
        .selectAll("text")
        .attr("opacity", (d: unknown) => filterOpacity(d as GraphNode));

      function linkIsHighlighted(d: GraphLink): boolean {
        if (!allHighlighted || !sid) return false;
        const src = (d.source as GraphNode).id;
        const tgt = (d.target as GraphNode).id;
        return (
          (src === sid || allHighlighted.has(src)) &&
          (tgt === sid || allHighlighted.has(tgt))
        );
      }

      link
        .attr("stroke", (d: GraphLink) =>
          linkIsHighlighted(d) ? "#3b82f6" : "#ccc",
        )
        .attr("stroke-width", (d: GraphLink) =>
          linkIsHighlighted(d) ? 2.5 : 1.5,
        )
        .attr("stroke-opacity", (d: GraphLink) => {
          const srcNode = d.source as GraphNode;
          const tgtNode = d.target as GraphNode;
          if (
            hasActiveFilters &&
            (!nodePassesFilter(srcNode) || !nodePassesFilter(tgtNode))
          )
            return 0.05;
          return linkIsHighlighted(d) ? 1 : 0.6;
        });
    }

    applyHighlight();

    const svgEl = svgRef.current;
    const handler = () => applyHighlight();
    svgEl?.addEventListener("graph-selection-change", handler);
    return () => {
      svgEl?.removeEventListener("graph-selection-change", handler);
    };
  }, [
    filteredUserIds,
    hasActiveFilters,
    loading,
    activeUsers,
    friendEdges,
    spread,
  ]);

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
        <label className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-gray-600">Role</span>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
            className="rounded border border-gray-300 px-2 py-1 text-xs bg-white"
          >
            <option value="all">All</option>
            <option value="admin">Admin</option>
            <option value="staff">Staff</option>
            <option value="regular">Regular</option>
          </select>
        </label>

        <label className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-gray-600">Community</span>
          <select
            value={communityFilter}
            onChange={(e) => setCommunityFilter(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-xs bg-white"
          >
            <option value="all">All</option>
            {availableCommunities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-gray-600">Tag</span>
          <select
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-xs bg-white"
          >
            <option value="all">All</option>
            {availableTags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

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
            onClick={clearFilters}
            className="text-sm text-zinc-500 hover:text-zinc-700 hover:underline"
          >
            Reset filters
          </button>
        )}
      </div>

      <svg ref={svgRef} className="flex-1 w-full min-h-0" />
    </div>
  );
};

export default FriendGraphPage;
