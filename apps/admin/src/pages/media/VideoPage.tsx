import { thrownStatus } from "@alliance/shared/lib/hey-api";
import VideoPlayer from "@alliance/sharedweb/forms/VideoPlayer";
import { useParams } from "react-router";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { formatDateTime } from "../../lib/formatDate";
import { countOf } from "../../lib/formatNumber";
import { useVideoAdmin } from "../../lib/useVideosAdmin";
import { RecordId } from "../../places";
import Button, { ButtonVariant } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { Skeleton } from "../../ui/Skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/Table";
import { Panel } from "../../ui/templates/Overview";
import { Page } from "../../ui/templates/Page";
import {
  Fact,
  FactList,
  RecordBody,
  SidePanelSection,
} from "../../ui/templates/Record";
import {
  ContentState,
  LOAD_FAILED_FALLBACK,
  RefreshFailedBanner,
} from "../../ui/templates/States";
import { formatSize, VIDEOS_HREF } from "./mediaRules";
import { ReplaceVideoSection } from "./ReplaceVideoSection";

export default function VideoPage() {
  const { videoId } = useParams();
  const id = Number(videoId);
  const validId = Number.isInteger(id);
  const detail = useVideoAdmin(id, { enabled: validId });
  const video = detail.data;
  const notFound =
    !validId || (detail.isError && thrownStatus(detail.error) === 404);

  return (
    <Page
      record={RecordId.Video}
      title={video?.originalFilename}
      description={video ? `Video ID ${video.id}` : ""}
      banner={<RefreshFailedBanner things="this video" query={detail} />}
    >
      <ContentState
        loading={validId && detail.isPending}
        skeleton={
          <RecordBody side={<Skeleton className="h-48 w-full rounded-card" />}>
            <Skeleton className="h-96 w-full rounded-card" />
            <Skeleton className="h-64 w-full rounded-card" />
          </RecordBody>
        }
        error={
          detail.isLoadingError && !notFound
            ? adminRefusalMessage(detail.error, LOAD_FAILED_FALLBACK)
            : null
        }
        errorTitle="Couldn't load this video"
        onRetry={() => void detail.refetch()}
        retrying={detail.isFetching}
        empty={!video}
        emptyTitle="Video not found"
        emptyDescription="It may have been deleted."
        emptyAction={
          <Button variant={ButtonVariant.Default} to={VIDEOS_HREF}>
            All videos
          </Button>
        }
      >
        {video && (
          <RecordBody
            side={
              <SidePanelSection title="Video info">
                <FactList>
                  <Fact label="Original size">{formatSize(video.size)}</Fact>
                  <Fact label="Output size">
                    {formatSize(video.totalOutputSize)}
                  </Fact>
                  <Fact label="MIME type">{video.mime}</Fact>
                  <Fact label="Created">
                    {formatDateTime(video.dateCreated)}
                  </Fact>
                  <Fact label="Updated">
                    {formatDateTime(video.dateUpdated)}
                  </Fact>
                </FactList>
              </SidePanelSection>
            }
          >
            <Panel title="Player">
              <VideoPlayer src="" videoId={video.id} />
            </Panel>
            <Panel
              title="HLS files"
              description={
                video.segments.length > 0 &&
                `${countOf(video.segments.length, "file")} · ${formatSize(video.totalOutputSize)} total`
              }
              flush
            >
              {video.segments.length === 0 ? (
                <EmptyState title="No files found" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Filename</TableHead>
                      <TableHead className="text-right">Size</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {video.segments.map((segment) => (
                      <TableRow key={segment.key}>
                        <TableCell className="font-mono text-xs">
                          {segment.filename}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatSize(segment.size)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Panel>
            <ReplaceVideoSection
              videoId={video.id}
              filename={video.originalFilename}
            />
          </RecordBody>
        )}
      </ContentState>
    </Page>
  );
}
