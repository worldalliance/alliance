import { copyToClipboard } from "@alliance/sharedweb/lib/clipboard";
import { useMemo, useState } from "react";
import { countOf } from "../../lib/formatNumber";
import { useClustersAdmin } from "../../lib/useClustersAdmin";
import { PlaceId } from "../../places";
import Button, { ButtonVariant } from "../../ui/Button";
import Card from "../../ui/Card";
import { Skeleton } from "../../ui/Skeleton";
import { Banner, BannerTone } from "../../ui/templates/Banner";
import {
  FilterBar,
  ListContent,
  listCount,
  SearchField,
  useListSearch,
} from "../../ui/templates/List";
import { Page } from "../../ui/templates/Page";
import { ContentState, RefreshFailedBanner } from "../../ui/templates/States";
import { useToast } from "../../ui/ToastProvider";
import { ClusterCard } from "./ClusterCard";
import { clustermatesByMember, matchingClusters } from "./clustermates";

export default function ClustersPage() {
  const list = useClustersAdmin();
  const [q, setQ] = useListSearch();
  const [copyFailed, setCopyFailed] = useState(false);
  // Clusters renamed under this search stay shown until it changes, so a new
  // name that no longer matches doesn't make the card vanish mid-edit.
  const [renamed, setRenamed] = useState({ q, ids: new Set<number>() });
  const { success } = useToast();

  const clusters = list.data;
  const rows = useMemo(() => {
    const kept = renamed.q === q ? renamed.ids : new Set<number>();
    const matches = new Set(matchingClusters(clusters ?? [], q));
    return (clusters ?? []).filter((c) => matches.has(c) || kept.has(c.id));
  }, [clusters, q, renamed]);
  const keepShown = (id: number) =>
    setRenamed((prev) => ({
      q,
      ids: new Set(prev.q === q ? prev.ids : []).add(id),
    }));
  const placed =
    clusters?.reduce((sum, cluster) => sum + cluster.members.length, 0) ?? 0;

  const exportClustermates = async () => {
    const payload = clustermatesByMember(clusters ?? []);
    const copied = await copyToClipboard(JSON.stringify(payload, null, 2));
    setCopyFailed(!copied);
    if (copied) {
      success(
        `Copied clustermates for ${countOf(Object.keys(payload).length, "member")}`,
      );
    }
  };

  return (
    <Page
      fill
      place={PlaceId.Clusters}
      description={
        clusters
          ? `${countOf(clusters.length, "cluster")}, ${countOf(placed, "member")} placed`
          : ""
      }
      actions={
        <Button
          variant={ButtonVariant.Default}
          disabled={!clusters?.length}
          title="Copies a JSON object mapping each member's id to a markdown list of their clustermates"
          onClick={() => void exportClustermates()}
        >
          Export clustermates
        </Button>
      }
      banner={
        <>
          <RefreshFailedBanner things="clusters" query={list} />
          {copyFailed && (
            <Banner
              tone={BannerTone.Danger}
              action={
                <Button
                  size="small"
                  variant={ButtonVariant.Ghost}
                  onClick={() => setCopyFailed(false)}
                >
                  Dismiss
                </Button>
              }
            >
              Couldn't copy the clustermates to the clipboard.
            </Banner>
          )}
        </>
      }
    >
      <FilterBar
        count={listCount({
          shown: rows.length,
          total: clusters?.length,
          noun: "cluster",
        })}
      >
        <SearchField
          label="Filter clusters or members"
          value={q}
          onChange={setQ}
        />
      </FilterBar>
      <ListContent cards>
        <ContentState
          things="clusters"
          query={list}
          refreshBanner={false}
          skeleton={<ClustersSkeleton />}
          empty={rows.length === 0}
          filtered={q !== ""}
          onClearFilters={() => setQ("")}
          emptyTitle="No clusters yet"
        >
          {rows.map((cluster) => (
            <ClusterCard
              key={cluster.id}
              cluster={cluster}
              onSave={keepShown}
            />
          ))}
        </ContentState>
      </ListContent>
    </Page>
  );
}

function ClustersSkeleton() {
  return (
    <div className="flex flex-col gap-section">
      {[0, 1, 2].map((key) => (
        <Card key={key} className="gap-4">
          <div className="flex min-h-control items-center gap-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="ml-auto h-4 w-20" />
          </div>
          <div className="flex flex-wrap gap-2">
            {[0, 1, 2, 3, 4].map((chip) => (
              <Skeleton key={chip} className="h-8 w-32 rounded-full" />
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
