import { useCallback, useMemo, useState } from "react";
import { EnumFilterSelect } from "../../components/force-graph/EnumFilterSelect";
import {
  type DrawnGraph,
  ForceGraph,
  KEEP_LAYOUT,
  linkEnd,
} from "../../components/force-graph/ForceGraph";
import {
  type UserFilterOption,
  UserGraphFilterControls,
  useUserGraphFilters,
} from "../../components/force-graph/UserGraphFilters";
import { countOf, formatCount } from "../../lib/formatNumber";
import { useCampaignsAdmin } from "../../lib/useCampaignsAdmin";
import { useGraphUsersAdmin } from "../../lib/useGraphUsersAdmin";
import { useOnetimeInviteGraphEdgesAdmin } from "../../lib/useOnetimeInviteGraphEdgesAdmin";
import Button, { ButtonVariant } from "../../ui/Button";
import { Skeleton } from "../../ui/Skeleton";
import { Banner, BannerTone } from "../../ui/templates/Banner";
import { CheckboxField } from "../../ui/templates/Form";
import { ContentState } from "../../ui/templates/States";
import {
  PaneHeader,
  Workspace,
  WorkspaceToolbar,
} from "../../ui/templates/Workspace";
import {
  buildInviteGraph,
  type GraphLink,
  type GraphNode,
  NodeKind,
} from "./buildInviteGraph";
import { GraphLegend } from "./InviteGraphLegend";
import {
  LINK_TONE,
  LinkTone,
  NODE_RADIUS,
  NODE_STYLE,
  SELECTED_STROKE,
} from "./inviteGraphStyle";

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

/** Only user nodes are subject to the contract, role, group and tag filters. */
const FILTERABLE: Record<NodeKind, boolean> = {
  [NodeKind.User]: true,
  [NodeKind.Unattributed]: false,
  [NodeKind.Campaign]: false,
};

const nodeStyle = (node: GraphNode) => NODE_STYLE[node.kind];

type Selected = { name: string; ancestors: number; descendants: number };

export function InviteGraphTab() {
  const usersQuery = useGraphUsersAdmin(KEEP_LAYOUT);
  const users = useMemo(() => usersQuery.data ?? [], [usersQuery.data]);
  const campaignsQuery = useCampaignsAdmin(KEEP_LAYOUT);
  const campaigns = useMemo(
    () => campaignsQuery.data ?? [],
    [campaignsQuery.data],
  );
  const edgesQuery = useOnetimeInviteGraphEdgesAdmin(KEEP_LAYOUT);
  const inviteEdges = useMemo(
    () => (edgesQuery.isError ? [] : (edgesQuery.data ?? [])),
    [edgesQuery.isError, edgesQuery.data],
  );

  const [contractFilter, setContractFilter] = useState(ContractFilter.Active);
  const [isolateSubgraph, setIsolateSubgraph] = useState(false);
  const [selected, setSelected] = useState<Selected | null>(null);

  // A failed request leaves a whole class of edges out of the graph, which
  // reads as "no attribution" rather than as a failure.
  const failed = [
    { name: "users", failed: usersQuery.isError },
    { name: "used invites", failed: edgesQuery.isError },
    { name: "campaigns", failed: campaignsQuery.isError },
  ]
    .filter((load) => load.failed)
    .map((load) => load.name);

  const filters = useUserGraphFilters(users);
  const { matches: matchesUserFilters, clear: clearUserFilters } = filters;

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
  const nodesById = useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes],
  );

  const applyStyles = useCallback(
    ({ node, link }: DrawnGraph<GraphNode>, sid: string | null) => {
      function nodePassesFilter(d: GraphNode): boolean {
        if (!FILTERABLE[d.kind] || !d.userId) return true;
        return filteredUserIds.has(d.userId);
      }

      const descendants = sid ? getDescendants(sid) : new Set<string>();
      // The "no attribution" hub is drawn above everyone nobody invited, but
      // it isn't anyone who led to them.
      const ancestors = new Set(
        sid
          ? [...getAncestors(sid)].filter(
              (id) => nodesById.get(id)?.kind !== NodeKind.Unattributed,
            )
          : [],
      );
      const allHighlighted = sid
        ? new Set([sid, ...descendants, ...ancestors])
        : null;
      const selectedNode = sid ? nodesById.get(sid) : undefined;
      setSelected(
        selectedNode
          ? {
              name: selectedNode.displayName,
              ancestors: ancestors.size,
              descendants: descendants.size,
            }
          : null,
      );

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
          if (d.id === sid) return SELECTED_STROKE;
          if (ancestors.has(d.id)) return LINK_TONE[LinkTone.Ancestor].color;
          if (descendants.has(d.id))
            return LINK_TONE[LinkTone.Descendant].color;
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
        .attr("stroke-dasharray", (d) => LINK_TONE[linkTone(d)].dash)
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
      nodesById,
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

  const matchCount = hasActiveFilters
    ? users.filter((u) => filteredUserIds.has(u.id)).length
    : null;

  const loading =
    !usersQuery.isFetchedAfterMount ||
    !campaignsQuery.isFetchedAfterMount ||
    !edgesQuery.isFetchedAfterMount;

  return (
    <Workspace
      toolbar={
        <WorkspaceToolbar>
          <p className="min-w-0 flex-1 text-fg-muted">
            {loading
              ? ""
              : `${countOf(users.length, "user")}, ${countOf(inviteEdges.length, "used invite")}, ${countOf(campaignAttributedCount, "user")} from campaigns`}
            {!loading && matchCount !== null && (
              <span className="font-medium text-fg">
                {" "}
                · {formatCount(matchCount)} matching filters
              </span>
            )}
          </p>
          <Button
            size="small"
            variant={ButtonVariant.Default}
            onClick={clearFilters}
            disabled={!hasActiveFilters}
          >
            Reset filters
          </Button>
        </WorkspaceToolbar>
      }
      inspector={
        <>
          <PaneHeader title="Selection" />
          <div className="flex flex-col px-card py-4">
            <div className="flex min-h-16 flex-col gap-1">
              {selected ? (
                <>
                  <p className="font-medium">{selected.name}</p>
                  <p className="text-fg-muted">
                    {formatCount(selected.ancestors)} up the chain,{" "}
                    {formatCount(selected.descendants)} down it
                  </p>
                </>
              ) : (
                <p className="text-fg-muted">
                  Select a member or campaign to trace who led to them and whom
                  they invited. Select it again, or the background, to clear.
                </p>
              )}
            </div>
            <CheckboxField
              label="Isolate subgraph"
              help="Hides everyone outside the selection's chain."
              checked={isolateSubgraph}
              onChange={(event) => setIsolateSubgraph(event.target.checked)}
              className="mt-3"
            />
          </div>
          <PaneHeader title="Filters" />
          <div className="flex flex-col gap-3 px-card py-4 [&_select]:min-w-0">
            <EnumFilterSelect
              label="Contract"
              values={ContractFilter}
              options={CONTRACT_FILTERS}
              value={contractFilter}
              onChange={setContractFilter}
            />
            <UserGraphFilterControls filters={filters} />
          </div>
          <PaneHeader title="Legend" />
          <GraphLegend />
        </>
      }
    >
      {failed.length > 0 && (
        <Banner tone={BannerTone.Warning}>
          Couldn't load {failed.join(", ")}. The graph is incomplete:
          attribution from the missing data shows as no attribution.
        </Banner>
      )}
      <ContentState
        loading={loading}
        skeleton={<Skeleton className="m-card h-96" />}
        errorTitle="Couldn't load the invite graph"
      >
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
      </ContentState>
    </Workspace>
  );
}
