import type { VideoListItemDto } from "@alliance/shared/client/types.gen";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { formatDate } from "../../lib/formatDate";
import { formatCount } from "../../lib/formatNumber";
import { useConfirmOnPage } from "../../lib/useConfirmOnPage";
import { useRefusalToast } from "../../lib/useRefusalToast";
import { useDeleteVideoAdmin, useVideosAdmin } from "../../lib/useVideosAdmin";
import Button, { ButtonVariant } from "../../ui/Button";
import { nameLinkClass } from "../../ui/styles";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/Table";
import { Banner, BannerTone } from "../../ui/templates/Banner";
import { FilterBar, ListContent, SearchField } from "../../ui/templates/List";
import {
  ContentState,
  LOAD_FAILED_FALLBACK,
  TableSkeleton,
} from "../../ui/templates/States";
import { formatSize, videoHref } from "./mediaRules";

const DELETE_FAILED = "Failed to delete video";

export function VideosTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const setQ = (value: string) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set("q", value);
        else next.delete("q");
        return next;
      },
      { replace: true },
    );

  const confirm = useConfirmOnPage();
  const refusalToast = useRefusalToast();
  const list = useVideosAdmin();
  const all = list.data;
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (all ?? []).filter((video) =>
      video.originalFilename.toLowerCase().includes(needle),
    );
  }, [all, q]);

  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deletion = useDeleteVideoAdmin({
    onError: (error) => {
      setDeleteError(adminRefusalMessage(error, DELETE_FAILED));
      refusalToast(error, DELETE_FAILED);
    },
  });

  const deleteVideo = async (video: VideoListItemDto) => {
    const confirmed = await confirm({
      title: `Delete the video “${video.originalFilename}”?`,
      message: `Video ${video.id} disappears from the app, but its files stay in storage, so a direct link someone already copied keeps playing it.`,
      confirmLabel: "Delete video",
      destructive: true,
    });
    if (!confirmed) return;
    setDeleteError(null);
    deletion.mutate(video.id);
  };

  return (
    <>
      {deleteError && (
        <Banner
          tone={BannerTone.Danger}
          action={
            <Button
              size="small"
              variant={ButtonVariant.Ghost}
              onClick={() => setDeleteError(null)}
            >
              Dismiss
            </Button>
          }
        >
          {deleteError}
        </Banner>
      )}
      {list.isRefetchError && (
        <Banner
          tone={BannerTone.Danger}
          action={
            <Button
              size="small"
              variant={ButtonVariant.Ghost}
              onClick={() => void list.refetch()}
            >
              Try again
            </Button>
          }
        >
          Couldn’t refresh the videos, so this list may be out of date.{" "}
          {adminRefusalMessage(list.error, LOAD_FAILED_FALLBACK)}
        </Banner>
      )}
      <FilterBar
        count={
          all &&
          (rows.length === all.length
            ? `${formatCount(all.length)} ${all.length === 1 ? "video" : "videos"}`
            : `${formatCount(rows.length)} of ${formatCount(all.length)} videos`)
        }
      >
        <SearchField label="Filter videos" value={q} onChange={setQ} />
      </FilterBar>
      <ListContent>
        <ContentState
          loading={list.isPending}
          skeleton={<TableSkeleton bleed columns={5} />}
          error={
            list.isLoadingError
              ? adminRefusalMessage(list.error, LOAD_FAILED_FALLBACK)
              : null
          }
          errorTitle="Couldn't load videos"
          onRetry={() => void list.refetch()}
          empty={rows.length === 0}
          filtered={q !== ""}
          onClearFilters={() => setQ("")}
          emptyTitle="No videos yet"
          emptyDescription="A video uploaded to a form's video block is listed here."
        >
          <Table bleed>
            <TableHeader>
              <TableRow>
                <TableHead>Filename</TableHead>
                <TableHead>ID</TableHead>
                <TableHead className="text-right">Size</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((video) => (
                <TableRow key={video.id}>
                  <TableCell
                    className="max-w-64 truncate"
                    title={video.originalFilename}
                  >
                    <Link to={videoHref(video.id)} className={nameLinkClass}>
                      {video.originalFilename}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-fg-muted">
                    {video.id}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatSize(video.size)}
                  </TableCell>
                  <TableCell>{formatDate(video.dateCreated)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <Button
                        size="small"
                        aria-label={`Delete: ${video.originalFilename}`}
                        busy={
                          deletion.isPending && deletion.variables === video.id
                        }
                        onClick={() => void deleteVideo(video)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ContentState>
      </ListContent>
    </>
  );
}
