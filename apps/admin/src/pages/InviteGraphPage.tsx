import {
  OnetimeInviteDto,
  userGetOnetimeInvites,
  userListForGraph,
  UserDto,
} from "@alliance/shared/client";
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import {
  select,
  zoom,
  zoomIdentity,
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  drag,
} from "d3";
import type {
  Selection,
  SimulationNodeDatum,
  SimulationLinkDatum,
} from "d3";

interface GraphNode extends SimulationNodeDatum {
  id: string;
  userId?: number;
  displayName: string;
  profilePicture: string | null;
  isCenter?: boolean;
}

interface GraphLink extends SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
}

type ContractFilter = "all" | "active" | "inactive";
type RoleFilter = "all" | "admin" | "staff" | "regular";

interface GraphRefs {
  node: Selection<SVGGElement, GraphNode, SVGGElement, unknown>;
  link: Selection<SVGLineElement, GraphLink, SVGGElement, unknown>;
  getDescendants: (nodeId: string) => Set<string>;
  getAncestors: (nodeId: string) => Set<string>;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
}

const NODE_RADIUS = 20;
const CENTER_RADIUS = 14;

const InviteGraphPage = () => {
  const svgRef = useRef<SVGSVGElement>(null);
  const graphRef = useRef<GraphRefs | null>(null);
  const [users, setUsers] = useState<UserDto[]>([]);
  const [invites, setInvites] = useState<OnetimeInviteDto[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [contractFilter, setContractFilter] = useState<ContractFilter>("active");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [communityFilter, setCommunityFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [isolateSubgraph, setIsolateSubgraph] = useState(false);

  useEffect(() => {
    Promise.all([userListForGraph(), userGetOnetimeInvites()]).then(
      ([usersRes, invitesRes]) => {
        setUsers(usersRes.data ?? []);
        setInvites(invitesRes.data ?? []);
        setLoading(false);
      }
    );
  }, []);

  // Derive available communities and tags for dropdowns
  const availableCommunities = useMemo(() => {
    const map = new Map<number, string>();
    for (const u of users) {
      for (const c of u.communities ?? []) {
        if (!map.has(c.id)) map.set(c.id, c.name);
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, name]) => ({ id: String(id), name }));
  }, [users]);

  const availableTags = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of users) {
      for (const t of u.tags ?? []) {
        if (!map.has(t.id)) map.set(t.id, t.name);
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, name]) => ({ id, name }));
  }, [users]);

  // Build a set of user IDs that pass the filters
  const filteredUserIds = useMemo(() => {
    const ids = new Set<number>();
    for (const u of users) {
      if (contractFilter === "active" && !u.hasActiveContract) continue;
      if (contractFilter === "inactive" && u.hasActiveContract) continue;
      if (roleFilter === "admin" && !u.admin) continue;
      if (roleFilter === "staff" && !u.staff) continue;
      if (roleFilter === "regular" && (u.admin || u.staff)) continue;
      if (communityFilter !== "all") {
        const inCommunity = (u.communities ?? []).some(
          (c) => String(c.id) === communityFilter
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
  }, [users, contractFilter, roleFilter, communityFilter, tagFilter]);

  const hasActiveFilters =
    contractFilter !== "active" ||
    roleFilter !== "all" ||
    communityFilter !== "all" ||
    tagFilter !== "all";

  const clearFilters = useCallback(() => {
    setContractFilter("active");
    setRoleFilter("all");
    setCommunityFilter("all");
    setTagFilter("all");
  }, []);

  // Effect 1: Build the graph (only when data changes)
  useEffect(() => {
    if (loading || !svgRef.current) return;

    const svg = select(svgRef.current);
    svg.selectAll("*").remove();

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    // Build the graph data
    const usedInvites = invites.filter(
      (inv) => inv.status === "link_used" && inv.invitedUserId
    );

    // Users 7 and 10 are treated as the root node
    const ROOT_USER_IDS = new Set([7, 10]);
    const resolveNodeId = (userId: number) =>
      ROOT_USER_IDS.has(userId) ? "center" : `user-${userId}`;

    // Build nodes for all users (excluding root users, they become the center)
    const nodes: GraphNode[] = users
      .filter((u) => !ROOT_USER_IDS.has(u.id))
      .map((u) => ({
        id: `user-${u.id}`,
        userId: u.id,
        displayName: u.anonymous ? "Someone" : u.name,
        profilePicture: u.profilePicture,
      }));

    // Add center node (represents root users + uninvited)
    const rootUsers = users.filter((u) => ROOT_USER_IDS.has(u.id));
    const centerLabel = rootUsers
      .map((u) => (u.anonymous ? "Someone" : u.name))
      .join(" & ") || "Root";
    const centerNode: GraphNode = {
      id: "center",
      displayName: centerLabel,
      profilePicture: null,
      isCenter: true,
    };
    nodes.push(centerNode);

    // Build links from both invite system and referredBy, deduplicating
    const linkSet = new Set<string>(); // "sourceId->targetId"
    const links: GraphLink[] = [];

    const addLink = (sourceId: string, targetId: string) => {
      const key = `${sourceId}->${targetId}`;
      if (linkSet.has(key)) return;
      linkSet.add(key);
      links.push({ source: sourceId, target: targetId });
    };

    // Links from OnetimeInvite data
    for (const inv of usedInvites) {
      if (inv.invitingUser && inv.invitedUserId) {
        const src = resolveNodeId(inv.invitingUser.id);
        const tgt = resolveNodeId(inv.invitedUserId);
        if (src !== tgt) addLink(src, tgt);
      }
    }

    // Links from referredBy relation
    for (const u of users) {
      if (ROOT_USER_IDS.has(u.id)) continue;
      const referredById = (u as UserDto & { referredById?: number | null }).referredById;
      if (referredById != null) {
        const src = resolveNodeId(referredById);
        const tgt = resolveNodeId(u.id);
        if (src !== tgt) addLink(src, tgt);
      }
    }

    // Track which users have an incoming link (were referred/invited)
    const linkedTargets = new Set<string>();
    for (const l of links) {
      const tgt = typeof l.target === "string" ? l.target : l.target.id;
      linkedTargets.add(tgt);
    }

    // Users without any incoming link go to center
    for (const u of users) {
      if (ROOT_USER_IDS.has(u.id)) continue;
      if (!linkedTargets.has(`user-${u.id}`)) {
        addLink("center", `user-${u.id}`);
      }
    }

    // Build adjacency lists (source -> targets, target -> source)
    const childrenMap = new Map<string, Set<string>>();
    const parentMap = new Map<string, string>();
    for (const l of links) {
      const src = typeof l.source === "string" ? l.source : l.source.id;
      const tgt = typeof l.target === "string" ? l.target : l.target.id;
      if (!childrenMap.has(src)) childrenMap.set(src, new Set());
      childrenMap.get(src)!.add(tgt);
      parentMap.set(tgt, src);
    }

    // Collect all descendants (children, grandchildren, etc.)
    function getDescendants(nodeId: string): Set<string> {
      const result = new Set<string>();
      const stack = [nodeId];
      while (stack.length) {
        const current = stack.pop()!;
        const children = childrenMap.get(current);
        if (!children) continue;
        for (const child of children) {
          if (!result.has(child)) {
            result.add(child);
            stack.push(child);
          }
        }
      }
      return result;
    }

    // Walk up the parent chain to root
    function getAncestors(nodeId: string): Set<string> {
      const result = new Set<string>();
      let current = parentMap.get(nodeId);
      while (current && !result.has(current)) {
        result.add(current);
        current = parentMap.get(current);
      }
      return result;
    }

    // Create defs for clip paths and patterns
    const defs = svg.append("defs");

    // Clip path for user nodes
    defs
      .append("clipPath")
      .attr("id", "clip-node")
      .append("circle")
      .attr("r", NODE_RADIUS);

    defs
      .append("clipPath")
      .attr("id", "clip-center")
      .append("circle")
      .attr("r", CENTER_RADIUS);

    // Create image patterns for each user
    for (const node of nodes) {
      if (node.profilePicture && !node.isCenter) {
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

    // Zoom behavior
    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoomBehavior);

    // Create simulation
    const simulation = forceSimulation<GraphNode>(nodes)
      .force(
        "link",
        forceLink<GraphNode, GraphLink>(links)
          .id((d) => d.id)
          .distance(60)
      )
      .force("charge", forceManyBody().strength(-120))
      .force("center", forceCenter(width / 2, height / 2))
      .force("collision", forceCollide().radius(NODE_RADIUS + 5))
      .stop();

    // Pre-warm simulation so layout is stable before rendering
    const tickCount = 500;
    for (let i = 0; i < tickCount; i++) simulation.tick();

    // Draw links
    const link = g
      .append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "#ccc")
      .attr("stroke-width", 1.5)
      .attr("stroke-opacity", 0.6);

    // Draw arrow markers
    defs
      .append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", NODE_RADIUS + 10)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#ccc");

    defs
      .append("marker")
      .attr("id", "arrowhead-highlight")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", NODE_RADIUS + 10)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#3b82f6");

    defs
      .append("marker")
      .attr("id", "arrowhead-ancestor")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", NODE_RADIUS + 10)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#f59e0b");

    link.attr("marker-end", "url(#arrowhead)");

    // Draw nodes
    const node = g
      .append("g")
      .selectAll<SVGGElement, GraphNode>("g")
      .data(nodes)
      .join("g")
      .attr("cursor", "pointer");

    // Background circle (fallback / border)
    node
      .append("circle")
      .attr("r", (d) => (d.isCenter ? CENTER_RADIUS : NODE_RADIUS))
      .attr("fill", (d) => {
        if (d.isCenter) return "#e5e7eb";
        if (d.profilePicture) return `url(#pfp-${d.id})`;
        return "#e5e7eb";
      })
      .attr("stroke", (d) => (d.isCenter ? "#9ca3af" : "#d1d5db"))
      .attr("stroke-width", (d) => (d.isCenter ? 2 : 1.5));

    // Fallback icon for users without pfp (not center)
    node
      .filter((d) => !d.profilePicture && !d.isCenter)
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("font-size", 16)
      .attr("fill", "#9ca3af")
      .text("?");

    // Center node label
    node
      .filter((d) => !!d.isCenter)
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("font-size", 9)
      .attr("font-weight", "bold")
      .attr("fill", "#6b7280")
      .text("ROOT");

    // Name labels
    node
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", (d) => (d.isCenter ? CENTER_RADIUS + 14 : NODE_RADIUS + 14))
      .attr("font-size", 10)
      .attr("fill", "#374151")
      .text((d) => (d.isCenter ? "" : d.displayName));

    // Drag behavior
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

    // Store refs for the filter effect
    let selectedNodeId: string | null = null;
    graphRef.current = {
      node: node as unknown as GraphRefs["node"],
      link: link as unknown as GraphRefs["link"],
      getDescendants,
      getAncestors,
      selectedNodeId: null,
      setSelectedNodeId: (id) => {
        selectedNodeId = id;
        graphRef.current!.selectedNodeId = id;
      },
    };

    // Click to highlight subgraph
    node.on("click", (event, d) => {
      event.stopPropagation();
      graphRef.current!.setSelectedNodeId(
        selectedNodeId === d.id ? null : d.id
      );
      // Dispatch a custom event so the filter effect can re-apply
      svgRef.current?.dispatchEvent(
        new CustomEvent("graph-selection-change")
      );
    });

    // Click empty space to clear
    svg.on("click", () => {
      graphRef.current!.setSelectedNodeId(null);
      svgRef.current?.dispatchEvent(
        new CustomEvent("graph-selection-change")
      );
    });

    // Tooltip on hover
    node.append("title").text((d) => d.displayName);

    // Position update helper
    function updatePositions() {
      link
        .attr("x1", (d) => (d.source as GraphNode).x!)
        .attr("y1", (d) => (d.source as GraphNode).y!)
        .attr("x2", (d) => (d.target as GraphNode).x!)
        .attr("y2", (d) => (d.target as GraphNode).y!);

      node.attr("transform", (d) => `translate(${d.x},${d.y})`);
    }

    // Apply pre-warmed positions
    updatePositions();

    // Re-enable simulation for interactive dragging
    simulation.on("tick", updatePositions).restart();

    // Initial zoom to fit
    svg.call(
      zoomBehavior.transform,
      zoomIdentity
        .translate(width / 2, height / 2)
        .scale(0.8)
        .translate(-width / 2, -height / 2)
    );

    return () => {
      simulation.stop();
      graphRef.current = null;
    };
  }, [loading, users, invites]);

  // Effect 2: Apply filter visuals (runs on filter changes without rebuilding graph)
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;

    const { node, link, getDescendants, getAncestors } = graph;

    function nodePassesFilter(d: GraphNode): boolean {
      if (d.isCenter) return true;
      if (!d.userId) return true;
      return filteredUserIds.has(d.userId);
    }

    function applyHighlight() {
      const sid = graphRef.current?.selectedNodeId ?? null;
      const descendants = sid ? getDescendants(sid) : new Set<string>();
      const ancestors = sid ? getAncestors(sid) : new Set<string>();
      const allHighlighted = sid
        ? new Set([sid, ...descendants, ...ancestors])
        : null;

      node
        .select("circle")
        .attr("opacity", (d: GraphNode) => {
          if (!nodePassesFilter(d)) return hasActiveFilters ? 0.08 : 1;
          if (!allHighlighted) return 1;
          if (isolateSubgraph && !allHighlighted.has(d.id)) return 0;
          return allHighlighted.has(d.id) ? 1 : 0.15;
        })
        .attr("stroke", (d: GraphNode) => {
          if (!allHighlighted)
            return d.isCenter ? "#9ca3af" : "#d1d5db";
          if (d.id === sid) return "#3b82f6";
          if (ancestors.has(d.id)) return "#f59e0b";
          if (descendants.has(d.id)) return "#60a5fa";
          return d.isCenter ? "#9ca3af" : "#d1d5db";
        })
        .attr("stroke-width", (d: GraphNode) => {
          if (!allHighlighted) return d.isCenter ? 2 : 1.5;
          if (d.id === sid) return 3;
          if (allHighlighted.has(d.id)) return 2.5;
          return d.isCenter ? 2 : 1.5;
        });

      node.selectAll("text").attr("opacity", (d: unknown) => {
        const gn = d as GraphNode;
        if (!nodePassesFilter(gn)) return hasActiveFilters ? 0.08 : 1;
        if (!allHighlighted) return 1;
        if (isolateSubgraph && !allHighlighted.has(gn.id)) return 0;
        return allHighlighted.has(gn.id) ? 1 : 0.15;
      });

      function linkHighlightColor(d: GraphLink): string | null {
        if (!allHighlighted || !sid) return null;
        const src = (d.source as GraphNode).id;
        const tgt = (d.target as GraphNode).id;
        if (
          (ancestors.has(src) || src === sid) &&
          (ancestors.has(tgt) || tgt === sid)
        ) {
          return "#f59e0b";
        }
        if (
          (descendants.has(src) || src === sid) &&
          (descendants.has(tgt) || tgt === sid)
        ) {
          return "#3b82f6";
        }
        return null;
      }

      link
        .attr("stroke", (d: GraphLink) => linkHighlightColor(d) ?? "#ccc")
        .attr("stroke-width", (d: GraphLink) =>
          linkHighlightColor(d) ? 2.5 : 1.5
        )
        .attr("stroke-opacity", (d: GraphLink) => {
          const srcNode = d.source as GraphNode;
          const tgtNode = d.target as GraphNode;
          if (
            hasActiveFilters &&
            (!nodePassesFilter(srcNode) || !nodePassesFilter(tgtNode))
          )
            return 0.05;
          if (!allHighlighted) return 0.6;
          const color = linkHighlightColor(d);
          if (color) return 1;
          if (isolateSubgraph) return 0;
          return 0.1;
        })
        .attr("marker-end", (d: GraphLink) => {
          const color = linkHighlightColor(d);
          if (color === "#f59e0b") return "url(#arrowhead-ancestor)";
          if (color === "#3b82f6") return "url(#arrowhead-highlight)";
          return "url(#arrowhead)";
        });
    }

    // Apply immediately
    applyHighlight();

    // Also re-apply when node selection changes (from clicks)
    const svgEl = svgRef.current;
    const handler = () => applyHighlight();
    svgEl?.addEventListener("graph-selection-change", handler);
    return () => {
      svgEl?.removeEventListener("graph-selection-change", handler);
    };
  }, [filteredUserIds, hasActiveFilters, isolateSubgraph]);

  const matchCount = useMemo(() => {
    if (!hasActiveFilters) return null;
    return users.filter((u) => filteredUserIds.has(u.id)).length;
  }, [users, filteredUserIds, hasActiveFilters]);

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
        <h2 className="text-lg font-bold">Invite Graph</h2>
        <p className="text-sm text-gray-500">
          {users.length} users,{" "}
          {invites.filter((i) => i.status === "link_used").length} used invites
          {matchCount !== null && ` \u2014 ${matchCount} matching filters`}
        </p>
      </div>

      {/* Filters */}
      <div className="px-4 py-2 border-b border-gray-200 shrink-0 flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-gray-600">Contract</span>
          <select
            value={contractFilter}
            onChange={(e) =>
              setContractFilter(e.target.value as ContractFilter)
            }
            className="rounded border border-gray-300 px-2 py-1 text-xs bg-white"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>

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
          <input
            type="checkbox"
            checked={isolateSubgraph}
            onChange={(e) => setIsolateSubgraph(e.target.checked)}
            className="rounded border-gray-300"
          />
          <span className="text-xs font-medium text-gray-600">
            Isolate subgraph
          </span>
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

export default InviteGraphPage;
