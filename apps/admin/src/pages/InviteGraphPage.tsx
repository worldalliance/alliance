import {
  CampaignDto,
  OnetimeInviteEdgeDto,
  UserDto,
  campaignFindAllAdmin,
  userGetOnetimeInviteGraphEdgesAdmin,
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

enum NodeKind {
  User = "user",
  /**
   * Hub every user with no referral attribution hangs off, so the graph stays
   * one connected component instead of a scatter of free-floating trees.
   */
  Unattributed = "unattributed",
  Campaign = "campaign",
}

interface GraphNode extends SimulationNodeDatum {
  id: string;
  kind: NodeKind;
  userId?: number;
  displayName: string;
  profilePicture: string | null;
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
const HUB_RADIUS = 14;

interface NodeStyle {
  radius: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  /** Drawn inside the circle when the node has no picture. */
  glyph: (node: GraphNode) => string;
  glyphFontSize: number;
  glyphColor: string;
  /** How the display name is drawn under the circle; null draws no name. */
  label: { color: string; weight: string } | null;
}

const NODE_STYLE: Record<NodeKind, NodeStyle> = {
  [NodeKind.User]: {
    radius: NODE_RADIUS,
    fill: "#e5e7eb",
    stroke: "#d1d5db",
    strokeWidth: 1.5,
    glyph: () => "?",
    glyphFontSize: 16,
    glyphColor: "#9ca3af",
    label: { color: "#374151", weight: "normal" },
  },
  [NodeKind.Unattributed]: {
    radius: HUB_RADIUS,
    fill: "#f3f4f6",
    stroke: "#9ca3af",
    strokeWidth: 2,
    glyph: () => "NONE",
    glyphFontSize: 9,
    glyphColor: "#6b7280",
    label: null,
  },
  [NodeKind.Campaign]: {
    radius: NODE_RADIUS,
    fill: "#ede9fe",
    stroke: "#8b5cf6",
    strokeWidth: 2,
    glyph: (node) => node.displayName.charAt(0).toUpperCase(),
    glyphFontSize: 16,
    glyphColor: "#6d28d9",
    label: { color: "#6d28d9", weight: "bold" },
  },
};

const LEGEND: { kind: NodeKind; label: string }[] = [
  { kind: NodeKind.Campaign, label: "Campaign" },
  { kind: NodeKind.Unattributed, label: "NONE = no attribution" },
];

/** Only user nodes are subject to the contract/role/community/tag filters. */
const FILTERABLE: Record<NodeKind, boolean> = {
  [NodeKind.User]: true,
  [NodeKind.Unattributed]: false,
  [NodeKind.Campaign]: false,
};

const InviteGraphPage = () => {
  const svgRef = useRef<SVGSVGElement>(null);
  const graphRef = useRef<GraphRefs | null>(null);
  const [users, setUsers] = useState<UserDto[]>([]);
  const [inviteEdges, setInviteEdges] = useState<OnetimeInviteEdgeDto[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters
  const [contractFilter, setContractFilter] =
    useState<ContractFilter>("active");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [communityFilter, setCommunityFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [isolateSubgraph, setIsolateSubgraph] = useState(false);

  useEffect(() => {
    Promise.all([
      userListForGraphAdmin(),
      userGetOnetimeInviteGraphEdgesAdmin(),
      campaignFindAllAdmin(),
    ])
      .then(([usersRes, edgesRes, campaignsRes]) => {
        setUsers(usersRes.data ?? []);
        setInviteEdges(edgesRes.data ?? []);
        setCampaigns(campaignsRes.data ?? []);

        // A failed request leaves a whole class of edges out of the graph,
        // which reads as "no attribution" rather than as a failure — so name
        // what is missing instead of drawing a wrong graph.
        const failed = [
          { name: "users", error: usersRes.error },
          { name: "used invites", error: edgesRes.error },
          { name: "campaigns", error: campaignsRes.error },
        ].filter((request) => request.error !== undefined);

        for (const request of failed) {
          console.error(
            `Invite graph: could not load ${request.name}`,
            request.error,
          );
        }

        setLoadError(
          failed.length > 0
            ? `Could not load ${failed.map((request) => request.name).join(", ")}. The graph below is incomplete — attribution from the missing data shows as "no attribution".`
            : null,
        );
      })
      .catch(() =>
        setLoadError("Could not load the graph data. Try reloading the page."),
      )
      .finally(() => setLoading(false));
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

    const UNATTRIBUTED_ID = "unattributed";
    const userNodeId = (userId: number) => `user-${userId}`;
    const campaignNodeId = (campaignId: number) => `campaign-${campaignId}`;

    const nodes: GraphNode[] = users.map((u) => ({
      id: userNodeId(u.id),
      kind: NodeKind.User,
      userId: u.id,
      displayName: u.anonymous ? "Someone" : u.name,
      profilePicture: u.profilePicture,
    }));

    // A campaign gets a node only once someone is attributed to it
    const attributedCampaignIds = new Set(
      users
        .map((u) => u.referredByCampaignId)
        .filter((id): id is number => id != null),
    );
    const graphedCampaigns = campaigns.filter((c) =>
      attributedCampaignIds.has(c.id),
    );
    const graphedCampaignIds = new Set(graphedCampaigns.map((c) => c.id));
    for (const campaign of graphedCampaigns) {
      nodes.push({
        id: campaignNodeId(campaign.id),
        kind: NodeKind.Campaign,
        displayName: campaign.name,
        profilePicture: campaign.picture,
      });
    }

    const nodeIds = new Set(nodes.map((n) => n.id));

    // Build links from the invite system, referredBy and campaigns, deduplicating
    const linkSet = new Set<string>(); // "sourceId->targetId"
    const links: GraphLink[] = [];

    // A link to a node we never built throws inside d3's force layout and takes
    // the page down, so drop it — a partial load should draw a partial graph.
    const addLink = (sourceId: string, targetId: string) => {
      if (!nodeIds.has(sourceId) || !nodeIds.has(targetId)) return;
      const key = `${sourceId}->${targetId}`;
      if (linkSet.has(key)) return;
      linkSet.add(key);
      links.push({ source: sourceId, target: targetId });
    };

    // Links from OnetimeInvite data
    for (const edge of inviteEdges) {
      if (edge.invitingUserId === edge.invitedUserId) continue;
      addLink(userNodeId(edge.invitingUserId), userNodeId(edge.invitedUserId));
    }

    // Links from referredBy and referredByCampaign
    for (const u of users) {
      const referredById = u.referredById;
      if (referredById != null && referredById !== u.id) {
        addLink(userNodeId(referredById), userNodeId(u.id));
      }
      const campaignId = u.referredByCampaignId;
      if (campaignId != null && graphedCampaignIds.has(campaignId)) {
        addLink(campaignNodeId(campaignId), userNodeId(u.id));
      }
    }

    // Track which users have an incoming link (were referred/invited)
    const linkedTargets = new Set<string>();
    for (const l of links) {
      const tgt = typeof l.target === "string" ? l.target : l.target.id;
      linkedTargets.add(tgt);
    }

    // Whatever is left came from nowhere we can name — the earliest accounts
    // included, so their trees read as their own rather than as one blob
    const unattributedUsers = users.filter(
      (u) => !linkedTargets.has(userNodeId(u.id)),
    );
    if (unattributedUsers.length > 0) {
      nodes.push({
        id: UNATTRIBUTED_ID,
        kind: NodeKind.Unattributed,
        displayName: `No attribution (${unattributedUsers.length})`,
        profilePicture: null,
      });
      nodeIds.add(UNATTRIBUTED_ID);
      for (const u of unattributedUsers) {
        addLink(UNATTRIBUTED_ID, userNodeId(u.id));
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

    const defs = svg.append("defs");

    // Image patterns for user profile pictures and campaign avatars
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
          .distance(60),
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

    // Background circle (picture / fallback / border)
    node
      .append("circle")
      .attr("r", (d) => NODE_STYLE[d.kind].radius)
      .attr("fill", (d) =>
        d.profilePicture ? `url(#pfp-${d.id})` : NODE_STYLE[d.kind].fill,
      )
      .attr("stroke", (d) => NODE_STYLE[d.kind].stroke)
      .attr("stroke-width", (d) => NODE_STYLE[d.kind].strokeWidth);

    // Glyph inside the circle for nodes without a picture
    node
      .filter((d) => !d.profilePicture)
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("font-size", (d) => NODE_STYLE[d.kind].glyphFontSize)
      .attr("font-weight", "bold")
      .attr("fill", (d) => NODE_STYLE[d.kind].glyphColor)
      .text((d) => NODE_STYLE[d.kind].glyph(d));

    // Name labels
    node
      .filter((d) => NODE_STYLE[d.kind].label !== null)
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", (d) => NODE_STYLE[d.kind].radius + 14)
      .attr("font-size", 10)
      .attr("font-weight", (d) => NODE_STYLE[d.kind].label?.weight ?? null)
      .attr("fill", (d) => NODE_STYLE[d.kind].label?.color ?? null)
      .text((d) => d.displayName);

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
        selectedNodeId === d.id ? null : d.id,
      );
      // Dispatch a custom event so the filter effect can re-apply
      svgRef.current?.dispatchEvent(new CustomEvent("graph-selection-change"));
    });

    // Click empty space to clear
    svg.on("click", () => {
      graphRef.current!.setSelectedNodeId(null);
      svgRef.current?.dispatchEvent(new CustomEvent("graph-selection-change"));
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
        .translate(-width / 2, -height / 2),
    );

    return () => {
      simulation.stop();
      graphRef.current = null;
    };
  }, [loading, users, inviteEdges, campaigns]);

  // Effect 2: Apply filter visuals (runs on filter changes without rebuilding graph)
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;

    const { node, link, getDescendants, getAncestors } = graph;

    function nodePassesFilter(d: GraphNode): boolean {
      if (!FILTERABLE[d.kind] || !d.userId) return true;
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
          if (!allHighlighted) return NODE_STYLE[d.kind].stroke;
          if (d.id === sid) return "#3b82f6";
          if (ancestors.has(d.id)) return "#f59e0b";
          if (descendants.has(d.id)) return "#60a5fa";
          return NODE_STYLE[d.kind].stroke;
        })
        .attr("stroke-width", (d: GraphNode) => {
          if (!allHighlighted) return NODE_STYLE[d.kind].strokeWidth;
          if (d.id === sid) return 3;
          if (allHighlighted.has(d.id)) return 2.5;
          return NODE_STYLE[d.kind].strokeWidth;
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
          linkHighlightColor(d) ? 2.5 : 1.5,
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

  // Counts only the attributions the graph can draw: a campaign missing from
  // the fetch has no node, so its users appear under "no attribution".
  const campaignAttributedCount = useMemo(() => {
    const campaignIds = new Set(campaigns.map((c) => c.id));
    return users.filter(
      (u) =>
        u.referredByCampaignId != null &&
        campaignIds.has(u.referredByCampaignId),
    ).length;
  }, [users, campaigns]);

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
          {users.length} users, {inviteEdges.length} used invites,{" "}
          {campaignAttributedCount} from campaigns
          {matchCount !== null && ` \u2014 ${matchCount} matching filters`}
        </p>
      </div>

      {loadError && (
        <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 shrink-0">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <span>{loadError}</span>
        </div>
      )}

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

        <div className="ml-auto flex items-center gap-3 text-xs text-gray-500">
          {LEGEND.map((item) => (
            <span key={item.kind} className="flex items-center gap-1">
              <span
                className="inline-block h-3 w-3 rounded-full border-2"
                style={{
                  backgroundColor: NODE_STYLE[item.kind].fill,
                  borderColor: NODE_STYLE[item.kind].stroke,
                }}
              />
              {item.label}
            </span>
          ))}
        </div>
      </div>

      <svg ref={svgRef} className="flex-1 w-full min-h-0" />
    </div>
  );
};

export default InviteGraphPage;
