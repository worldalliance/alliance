import { useCallback, useMemo, useState } from "react";
import { FailedLoadsBanner } from "../../components/FailedLoadsBanner";
import {
  type DrawnGraph,
  ForceGraph,
  KEEP_LAYOUT,
  linkEnd,
} from "../../components/force-graph/ForceGraph";
import { useUserGraphFilters } from "../../components/force-graph/UserGraphFilters";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { countOf } from "../../lib/formatNumber";
import { useFriendGraphEdgesAdmin } from "../../lib/useFriendGraphEdgesAdmin";
import { useGraphUsersAdmin } from "../../lib/useGraphUsersAdmin";
import { PlaceId } from "../../places";
import { Skeleton } from "../../ui/Skeleton";
import { Page } from "../../ui/templates/Page";
import { ContentState, LOAD_FAILED_FALLBACK } from "../../ui/templates/States";
import { Workspace } from "../../ui/templates/Workspace";
import {
  buildFriendGraph,
  graphColor,
  type GraphLink,
  type GraphNode,
  NODE_STYLE,
} from "./friendGraph";
import { FriendGraphInspector, SPREAD } from "./FriendGraphInspector";

const nodeStyle = () => NODE_STYLE;
const FADED_NODE = 0.08;
const FADED_EDGE = 0.05;

export default function FriendGraphPage() {
  const usersQuery = useGraphUsersAdmin(KEEP_LAYOUT);
  const edgesQuery = useFriendGraphEdgesAdmin(KEEP_LAYOUT);
  const [spread, setSpread] = useState<number>(SPREAD.initial);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const members = useMemo(
    () => (usersQuery.data ?? []).filter((u) => u.hasActiveContract),
    [usersQuery.data],
  );
  const edges = useMemo(
    () => (edgesQuery.isError ? [] : (edgesQuery.data ?? [])),
    [edgesQuery.isError, edgesQuery.data],
  );
  const filters = useUserGraphFilters(members);
  const matchingIds = useMemo(
    () => new Set(members.filter(filters.matches).map((u) => u.id)),
    [members, filters.matches],
  );
  const { nodes, links, neighbors } = useMemo(
    () => buildFriendGraph(members, edges),
    [members, edges],
  );

  const applyStyles = useCallback(
    ({ node, link }: DrawnGraph<GraphNode>, selected: string | null) => {
      // ForceGraph owns the selection and reports it only here.
      setSelectedId(selected);
      const friends = selected ? neighbors.get(selected) : undefined;
      const lit = (id: string) => id === selected || !!friends?.has(id);
      const shown = (d: GraphNode) =>
        !filters.isActive || matchingIds.has(d.userId);
      const linkLit = (d: GraphLink) =>
        selected !== null &&
        lit(linkEnd(d.source).id) &&
        lit(linkEnd(d.target).id);

      node
        .select("circle")
        .attr("opacity", (d) => (shown(d) ? 1 : FADED_NODE))
        .attr("stroke", (d) =>
          lit(d.id) ? graphColor.selected : NODE_STYLE.stroke,
        )
        .attr("stroke-width", (d) => {
          if (d.id === selected) return 3;
          return lit(d.id) ? 2 : NODE_STYLE.strokeWidth;
        });
      node
        .selectAll<SVGTextElement, GraphNode>("text")
        .attr("opacity", (d) => (shown(d) ? 1 : FADED_NODE));
      link
        .attr("stroke", (d) =>
          linkLit(d) ? graphColor.selected : graphColor.edge,
        )
        .attr("stroke-width", (d) => (linkLit(d) ? 2.5 : 1.5))
        .attr("stroke-opacity", (d) => {
          if (!shown(linkEnd(d.source)) || !shown(linkEnd(d.target)))
            return FADED_EDGE;
          return linkLit(d) ? 1 : 0.6;
        });
    },
    [neighbors, matchingIds, filters.isActive],
  );

  const selected = nodes.find((n) => n.id === selectedId) ?? null;
  const friends = useMemo(
    () =>
      nodes
        .filter(
          (n) => selectedId !== null && neighbors.get(selectedId)?.has(n.id),
        )
        .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [nodes, neighbors, selectedId],
  );

  const ready =
    usersQuery.isFetchedAfterMount && edgesQuery.isFetchedAfterMount;
  // The pane names and retries every failed load while it shows the members error.
  const failed = usersQuery.isLoadingError
    ? []
    : [
        ...(usersQuery.isRefetchError ? ["members"] : []),
        ...(edgesQuery.isError ? ["friendships"] : []),
      ];
  const retryFailed = () => {
    if (usersQuery.isError) void usersQuery.refetch();
    if (edgesQuery.isError) void edgesQuery.refetch();
  };
  const retrying = usersQuery.isFetching || edgesQuery.isFetching;

  return (
    <Page
      fill
      place={PlaceId.FriendGraph}
      description={
        ready && !usersQuery.isLoadingError
          ? `${countOf(nodes.length, "member")} with an active contract${edgesQuery.isError ? "" : `, ${countOf(links.length, "friendship")}`}`
          : ""
      }
      banner={
        <FailedLoadsBanner
          inline={false}
          failed={failed}
          consequence="The graph is incomplete."
          onRetry={retryFailed}
          retrying={retrying}
        />
      }
    >
      <Workspace
        inspector={
          <FriendGraphInspector
            filters={filters}
            matching={filters.isActive ? matchingIds.size : null}
            total={members.length}
            spread={spread}
            onSpreadChange={setSpread}
            selected={selected}
            friends={friends}
          />
        }
      >
        <ContentState
          loading={!ready}
          skeleton={
            <div className="p-card">
              <Skeleton className="h-96 w-full" />
            </div>
          }
          error={
            usersQuery.isLoadingError
              ? adminRefusalMessage(usersQuery.error, LOAD_FAILED_FALLBACK)
              : null
          }
          errorTitle={
            edgesQuery.isError
              ? "Couldn't load members or friendships"
              : "Couldn't load members"
          }
          onRetry={retryFailed}
          retrying={retrying}
          empty={nodes.length === 0}
          emptyTitle="No members with an active contract"
        >
          <ForceGraph
            nodes={nodes}
            links={links}
            nodeStyle={nodeStyle}
            chargeStrength={-spread}
            applyStyles={applyStyles}
          />
        </ContentState>
      </Workspace>
    </Page>
  );
}
