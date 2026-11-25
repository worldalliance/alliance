import type { VideoListItemDto } from "@alliance/shared/client/types.gen";
import { useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { formatDate } from "../../lib/formatDate";
import { videoHref } from "../../lib/hrefs";
import { useConfirmOnPage } from "../../lib/useConfirmOnPage";
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
import {
  FilterBar,
  ListContent,
  listCount,
  SearchField,
  useListSearch,
} from "../../ui/templates/List";
import {
  ContentState,
  LOAD_FAILED_FALLBACK,
  RefreshFailedBanner,
  TableSkeleton,
} from "../../ui/templates/States";
import { useFocusAfterRemoval } from "../../ui/useFocusAfterRemoval";
import { formatSize } from "./mediaRules";

const SIZE_COLUMN = "text-right tabular-nums";

export function VideosTab() {
  const [q, setQ] = useListSearch();
  const confirm = useConfirmOnPage();
  const list = useVideosAdmin();
  const all = list.data;
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (all ?? []).filter((video) =>
      video.originalFilename.toLowerCase().includes(needle),
    );
  }, [all, q]);

  const searchRef = useRef<{ focus: () => void }>(null);
  const focus = useFocusAfterRemoval({
    ids: rows.map((video) => video.id),
    fallback: searchRef,
  });

  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deletion = useDeleteVideoAdmin({
    onError: (error, id) => {
      const reason = adminRefusalMessage(error, "");
      setDeleteError(
        reason
          ? `Couldn't delete video ${id}: ${reason}`
          : `Couldn't delete video ${id}.`,
      );
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
    deletion.mutate(video.id, { onSuccess: focus.removing(video.id) });
  };

  return (
    <>
      <RefreshFailedBanner things="videos" query={list} />
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
      <FilterBar
        count={listCount({
          shown: rows.length,
          total: all?.length,
          noun: "video",
        })}
      >
        <SearchField
          ref={searchRef}
          label="Filter videos"
          value={q}
          onChange={setQ}
        />
      </FilterBar>
      <ListContent>
        <ContentState
          loading={list.isPending}
          skeleton={
            <TableSkeleton
              bleed
              columns={5}
              columnClassNames={[undefined, undefined, SIZE_COLUMN]}
            />
          }
          error={
            list.isLoadingError
              ? adminRefusalMessage(list.error, LOAD_FAILED_FALLBACK)
              : null
          }
          errorTitle="Couldn't load videos"
          onRetry={() => void list.refetch()}
          retrying={list.isFetching}
          empty={rows.length === 0}
          filtered={q !== ""}
          onClearFilters={() => setQ("")}
          emptyTitle="No videos yet"
          emptyDescription="A video uploaded in a video block is listed here."
        >
          <Table bleed>
            <TableHeader>
              <TableRow>
                <TableHead>Filename</TableHead>
                <TableHead>ID</TableHead>
                <TableHead className="text-right">Size</TableHead>
                <TableHead>Created</TableHead>
                <TableHead actions>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((video) => (
                <TableRow key={video.id} {...focus.row(video.id)}>
                  <TableCell truncate title={video.originalFilename}>
                    <Link to={videoHref(video.id)} className={nameLinkClass}>
                      {video.originalFilename}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-fg-muted">
                    {video.id}
                  </TableCell>
                  <TableCell className={SIZE_COLUMN}>
                    {formatSize(video.size)}
                  </TableCell>
                  <TableCell>{formatDate(video.dateCreated)}</TableCell>
                  <TableCell actions>
                    <Button
                      size="small"
                      aria-label={`Delete: ${video.originalFilename}, video ${video.id}`}
                      busy={
                        deletion.isPending && deletion.variables === video.id
                      }
                      onClick={() => void deleteVideo(video)}
                    >
                      Delete
                    </Button>
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
