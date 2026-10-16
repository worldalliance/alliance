import {
  OnetimeInviteEdgeDto,
  userGetOnetimeInviteGraphEdgesAdmin,
} from "@alliance/shared/client";
import { AlertTriangle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EnumFilterSelect } from "../components/force-graph/EnumFilterSelect";
import {
  type DrawnGraph,
  ForceGraph,
  linkEnd,
  type NodeStyle,
} from "../components/force-graph/ForceGraph";
import {
  type UserFilterOption,
  UserGraphFilterControls,
  useUserGraphFilters,
} from "../components/force-graph/UserGraphFilters";
import {
  buildInviteGraph,
  type GraphLink,
  type GraphNode,
  NodeKind,
} from "../components/invite-graph/buildInviteGraph";
import { useCampaignsAdmin } from "../lib/useCampaignsAdmin";
import { useGraphUsersAdmin } from "../lib/useGraphUsersAdmin";

enum ContractFilter {
  All = "all",
  Active = "active",
  Inactive = "inactive",
}

const CONTRACT_FILTERS: Record<ContractFilter, UserFilterOption> = {
  [ContractFilter.All]: { label: "All", matches: () => true },
  [ContractFilter.Active]: {
    label: "Active",
    matches: (u) => u.hasActiveContract,
  },
  [ContractFilter.Inactive]: {
    label: "Inactive",
    matches: (u) => !u.hasActiveContract,
  },
};

const NODE_RADIUS = 20;
const HUB_RADIUS = 14;

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

const nodeStyle = (node: GraphNode) => NODE_STYLE[node.kind];

enum LinkTone {
  Plain = "plain",
  Descendant = "descendant",
  Ancestor = "ancestor",
}

const LINK_TONE: Record<LinkTone, { color: string; markerId: string }> = {
  [LinkTone.Plain]: { color: "#ccc", markerId: "arrowhead" },
  [LinkTone.Descendant]: {
    color: "#3b82f6",
    markerId: "arrowhead-highlight",
  },
  [LinkTone.Ancestor]: { color: "#f59e0b", markerId: "arrowhead-ancestor" },
};

const InviteGraphPage = () => {
  const [inviteEdges, setInviteEdges] = useState<OnetimeInviteEdgeDto[]>([]);
  // A changed user or campaign list rebuilds the layout and drops the
  // selection, so the graph skips the refetches that land while an admin is
  // exploring it.
  const usersQuery = useGraphUsersAdmin({
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const users = useMemo(() => usersQuery.data ?? [], [usersQuery.data]);
  const campaignsQuery = useCampaignsAdmin({
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const campaigns = useMemo(
    () => campaignsQuery.data ?? [],
    [campaignsQuery.data],
  );
  const [loading, setLoading] = useState(true);
  const [edgesFailed, setEdgesFailed] = useState(false);
  const [unreachable, setUnreachable] = useState(false);

  // Filters
  const [contractFilter, setContractFilter] = useState(ContractFilter.Active);
  const [isolateSubgraph, setIsolateSubgraph] = useState(false);

  useEffect(() => {
    userGetOnetimeInviteGraphEdgesAdmin()
      .then((edgesRes) => {
        setInviteEdges(edgesRes.data ?? []);
        if (edgesRes.error !== undefined) {
          console.error(
            "Invite graph: could not load used invites",
            edgesRes.error,
          );
          setEdgesFailed(true);
        }
      })
      .catch(() => setUnreachable(true))
      .finally(() => setLoading(false));
  }, []);

  // A failed request leaves a whole class of edges out of the graph, which
  // reads as "no attribution" rather than as a failure — so name what is
  // missing instead of drawing a wrong graph.
  const failed = [
    { name: "users", failed: usersQuery.isError },
    { name: "used invites", failed: edgesFailed },
    { name: "campaigns", failed: campaignsQuery.isError },
  ]
    .filter((load) => load.failed)
    .map((load) => load.name);
  const loadError = unreachable
    ? "Could not load the graph data. Try reloading the page."
    : failed.length > 0
      ? `Could not load ${failed.join(", ")}. The graph below is incomplete — attribution from the missing data shows as "no attribution".`
      : null;

  const filters = useUserGraphFilters(users);
  const { matches: matchesUserFilters, clear: clearUserFilters } = filters;

  // Build a set of user IDs that pass the filters
  const filteredUserIds = useMemo(() => {
    const ids = new Set<number>();
    for (const u of users) {
      if (!CONTRACT_FILTERS[contractFilter].matches(u)) continue;
      if (!matchesUserFilters(u)) continue;
      ids.add(u.id);
    }
    return ids;
  }, [users, contractFilter, matchesUserFilters]);

  const hasActiveFilters =
    contractFilter !== ContractFilter.Active || filters.isActive;

  const clearFilters = useCallback(() => {
    setContractFilter(ContractFilter.Active);
    clearUserFilters();
  }, [clearUserFilters]);

  const { nodes, links, getDescendants, getAncestors } = useMemo(
    () => buildInviteGraph({ users, campaigns, inviteEdges }),
    [users, inviteEdges, campaigns],
  );

  const applyStyles = useCallback(
    ({ node, link }: DrawnGraph<GraphNode>, sid: string | null) => {
      function nodePassesFilter(d: GraphNode): boolean {
        if (!FILTERABLE[d.kind] || !d.userId) return true;
        return filteredUserIds.has(d.userId);
      }

      const descendants = sid ? getDescendants(sid) : new Set<string>();
      const ancestors = sid ? getAncestors(sid) : new Set<string>();
      const allHighlighted = sid
        ? new Set([sid, ...descendants, ...ancestors])
        : null;

      const opacity = (d: GraphNode) => {
        if (!nodePassesFilter(d)) return hasActiveFilters ? 0.08 : 1;
        if (!allHighlighted) return 1;
        if (isolateSubgraph && !allHighlighted.has(d.id)) return 0;
        return allHighlighted.has(d.id) ? 1 : 0.15;
      };

      node
        .select("circle")
        .attr("opacity", opacity)
        .attr("stroke", (d) => {
          if (!allHighlighted) return NODE_STYLE[d.kind].stroke;
          if (d.id === sid) return "#3b82f6";
          if (ancestors.has(d.id)) return "#f59e0b";
          if (descendants.has(d.id)) return "#60a5fa";
          return NODE_STYLE[d.kind].stroke;
        })
        .attr("stroke-width", (d) => {
          if (!allHighlighted) return NODE_STYLE[d.kind].strokeWidth;
          if (d.id === sid) return 3;
          if (allHighlighted.has(d.id)) return 2.5;
          return NODE_STYLE[d.kind].strokeWidth;
        });

      node
        .selectAll<SVGTextElement, GraphNode>("text")
        .attr("opacity", opacity);

      function linkTone(d: GraphLink): LinkTone {
        if (!allHighlighted || !sid) return LinkTone.Plain;
        const src = linkEnd(d.source).id;
        const tgt = linkEnd(d.target).id;
        if (
          (ancestors.has(src) || src === sid) &&
          (ancestors.has(tgt) || tgt === sid)
        ) {
          return LinkTone.Ancestor;
        }
        if (
          (descendants.has(src) || src === sid) &&
          (descendants.has(tgt) || tgt === sid)
        ) {
          return LinkTone.Descendant;
        }
        return LinkTone.Plain;
      }

      link
        .attr("stroke", (d) => LINK_TONE[linkTone(d)].color)
        .attr("stroke-width", (d) =>
          linkTone(d) === LinkTone.Plain ? 1.5 : 2.5,
        )
        .attr("stroke-opacity", (d) => {
          if (
            hasActiveFilters &&
            (!nodePassesFilter(linkEnd(d.source)) ||
              !nodePassesFilter(linkEnd(d.target)))
          )
            return 0.05;
          if (!allHighlighted) return 0.6;
          if (linkTone(d) !== LinkTone.Plain) return 1;
          if (isolateSubgraph) return 0;
          return 0.1;
        })
        .attr("marker-end", (d) => `url(#${LINK_TONE[linkTone(d)].markerId})`);
    },
    [
      getDescendants,
      getAncestors,
      filteredUserIds,
      hasActiveFilters,
      isolateSubgraph,
    ],
  );

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

  if (
    loading ||
    !usersQuery.isFetchedAfterMount ||
    !campaignsQuery.isFetchedAfterMount
  ) {
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
        <EnumFilterSelect
          label="Contract"
          values={ContractFilter}
          options={CONTRACT_FILTERS}
          value={contractFilter}
          onChange={setContractFilter}
        />

        <UserGraphFilterControls filters={filters} />

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

      <ForceGraph
        nodes={nodes}
        links={links}
        nodeStyle={nodeStyle}
        chargeStrength={-120}
        applyStyles={applyStyles}
        defs={Object.values(LINK_TONE).map(({ color, markerId }) => (
          <marker
            key={markerId}
            id={markerId}
            viewBox="0 -5 10 10"
            refX={NODE_RADIUS + 10}
            refY={0}
            markerWidth={6}
            markerHeight={6}
            orient="auto"
          >
            <path d="M0,-5L10,0L0,5" fill={color} />
          </marker>
        ))}
      />
    </div>
  );
};

export default InviteGraphPage;
