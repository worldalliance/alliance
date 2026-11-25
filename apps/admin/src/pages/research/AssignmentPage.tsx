import { thrownStatus } from "@alliance/shared/lib/hey-api";
import { useParams } from "react-router";
import { z } from "zod";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { formatDateTime } from "../../lib/formatDate";
import { useKoraAssignmentExport } from "../../lib/useKoraBatchesAdmin";
import { placeById, PlaceId, RecordId, tabHref } from "../../places";
import Button, { ButtonVariant } from "../../ui/Button";
import { Skeleton } from "../../ui/Skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/Table";
import { Banner, BannerTone } from "../../ui/templates/Banner";
import { Panel, PanelNote } from "../../ui/templates/Overview";
import { Page, PageBody } from "../../ui/templates/Page";
import {
  ContentState,
  LOAD_FAILED_FALLBACK,
  RefreshFailedBanner,
  TableSkeleton,
} from "../../ui/templates/States";

const ASSIGNMENTS_HREF = tabHref(placeById(PlaceId.KoraParticipants), {
  tab: "assignments",
});

const resultsSchema = z.object({
  results: z.array(
    z.looseObject({
      transcriptId: z.string(),
      status: z.string(),
      optedOut: z.boolean().optional(),
    }),
  ),
});

function ExportBody({
  exported,
}: {
  exported: Record<string, unknown> | null;
}) {
  if (!exported) {
    return (
      <Panel title="Results">
        <PanelNote>No export has been saved yet.</PanelNote>
      </Panel>
    );
  }
  const parsed = resultsSchema.safeParse(exported);
  return (
    <>
      {parsed.success ? (
        <Panel title="Results" flush>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Transcript</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Opted out</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parsed.data.results.map((r) => (
                <TableRow key={r.transcriptId}>
                  <TableCell className="font-mono text-xs">
                    {r.transcriptId}
                  </TableCell>
                  <TableCell>{r.status}</TableCell>
                  <TableCell>{r.optedOut ? "Yes" : "No"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      ) : (
        <Banner inline tone={BannerTone.Danger}>
          The export has no readable list of results. The raw export is below.
        </Banner>
      )}
      <Panel title="Raw export">
        <details>
          <summary className="cursor-pointer rounded-sm font-medium focus-ring">
            Show the export as saved
          </summary>
          <pre className="mt-3 max-h-96 overflow-auto rounded-md bg-surface-2 p-3 font-mono text-xs">
            {JSON.stringify(exported, null, 2)}
          </pre>
        </details>
      </Panel>
    </>
  );
}

export default function AssignmentPage() {
  const { assignmentId = "" } = useParams();
  const validId = z.uuid().safeParse(assignmentId).success;
  const query = useKoraAssignmentExport(assignmentId, { enabled: validId });
  const assignment = query.data;
  const notFound =
    !validId || (query.isError && thrownStatus(query.error) === 404);

  return (
    <Page
      record={RecordId.KoraAssignment}
      description={
        assignment
          ? [
              `Reviewer ${assignment.reviewerId}`,
              assignment.completedAt
                ? `Completed ${formatDateTime(assignment.completedAt)}`
                : "Not completed yet",
            ].join(" · ")
          : ""
      }
      banner={<RefreshFailedBanner things="this assignment" query={query} />}
    >
      <ContentState
        loading={validId && query.isPending}
        skeleton={
          <PageBody>
            <div className="overflow-hidden rounded-card border border-line bg-surface">
              <div className="flex min-h-12 items-center border-b border-line px-card">
                <Skeleton className="h-4 w-24" />
              </div>
              <TableSkeleton columns={3} rows={6} />
            </div>
          </PageBody>
        }
        error={
          query.isLoadingError && !notFound
            ? adminRefusalMessage(query.error, LOAD_FAILED_FALLBACK)
            : null
        }
        errorTitle="Couldn't load this assignment"
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
        empty={!assignment}
        emptyTitle="Assignment not found"
        emptyDescription="It may have been deleted."
        emptyAction={
          <Button variant={ButtonVariant.Default} to={ASSIGNMENTS_HREF}>
            Assignments
          </Button>
        }
      >
        {assignment && (
          <PageBody>
            <ExportBody exported={assignment.export} />
          </PageBody>
        )}
      </ContentState>
    </Page>
  );
}
