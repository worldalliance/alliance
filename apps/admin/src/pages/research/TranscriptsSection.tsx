import { Features } from "@alliance/common/features";
import type { KoraBatchDto } from "@alliance/shared/client";
import { isFeatureEnabled } from "@alliance/sharedweb/lib/config";
import { type RefObject, useRef, useState } from "react";
import { formatDate, formatDateTime } from "../../lib/formatDate";
import { formatCount } from "../../lib/formatNumber";
import {
  KoraBatchAction,
  useKoraBatchesAdmin,
} from "../../lib/useKoraBatchesAdmin";
import Badge, { BadgeTone } from "../../ui/Badge";
import Button, { ButtonVariant } from "../../ui/Button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/Table";
import { Banner, BannerTone } from "../../ui/templates/Banner";
import { Panel } from "../../ui/templates/Overview";
import { ContentState, TableSkeleton } from "../../ui/templates/States";
import { BatchHistoryPanel } from "./BatchHistoryPanel";
import { isOpen } from "./batchRules";
import { ChangeClosingDateDialog } from "./ChangeClosingDateDialog";
import { PreviewLink } from "./PreviewLink";
import { UploadBatchPanel } from "./UploadBatchPanel";
import { batchRowName, useBatchActions } from "./useBatchActions";

const NUM = "text-right tabular-nums";
const COLUMNS = [undefined, NUM, NUM, NUM, undefined, undefined, undefined];

function BatchStatus({ batch }: { batch: KoraBatchDto }) {
  if (batch.retiredAt) {
    return (
      <span className="flex items-center gap-1.5">
        <Badge>Retired</Badge>
        <span className="text-fg-muted">{formatDate(batch.retiredAt)}</span>
      </span>
    );
  }
  return isOpen(batch, new Date()) ? (
    <Badge tone={BadgeTone.Info}>Open</Badge>
  ) : (
    <Badge>Closed</Badge>
  );
}

function BatchesTable({
  batches,
  uploadRef,
}: {
  batches: KoraBatchDto[];
  uploadRef: RefObject<{ focus: () => void } | null>;
}) {
  const actions = useBatchActions(batches, uploadRef);
  const [changing, setChanging] = useState<KoraBatchDto | null>(null);
  const canDelete = isFeatureEnabled(Features.KoraStagingTools);
  return (
    <>
      {actions.problem && (
        <div className="border-b border-line p-3">
          <Banner
            inline
            tone={BannerTone.Danger}
            action={
              <Button
                size="small"
                variant={ButtonVariant.Ghost}
                onClick={actions.dismiss}
              >
                Dismiss
              </Button>
            }
          >
            {actions.problem}
          </Banner>
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Uploaded</TableHead>
            <TableHead className={NUM}>Transcripts</TableHead>
            <TableHead className={NUM}>Per assignment</TableHead>
            <TableHead className={NUM}>Reviews each</TableHead>
            <TableHead>Closes</TableHead>
            <TableHead>Status</TableHead>
            <TableHead actions>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {batches.map((batch) => {
            const name = batchRowName(batch);
            const pending = actions.pendingFor(batch);
            return (
              <TableRow key={batch.id} {...actions.row(batch.id)}>
                <TableCell className="font-medium whitespace-nowrap">
                  {formatDateTime(batch.createdAt)}
                </TableCell>
                <TableCell className={NUM}>
                  {formatCount(batch.transcriptCount)}
                </TableCell>
                <TableCell className={NUM}>
                  {formatCount(batch.transcriptsPerAssignment)}
                </TableCell>
                <TableCell className={NUM}>
                  {formatCount(batch.reviewsPerTranscript)}
                </TableCell>
                <TableCell>
                  <span className="flex flex-wrap items-center gap-x-2">
                    {batch.closesAt ? (
                      <span className="whitespace-nowrap">
                        {formatDateTime(batch.closesAt)}
                      </span>
                    ) : (
                      <span className="text-fg-muted">Not set</span>
                    )}
                    <Button
                      size="small"
                      variant={ButtonVariant.Ghost}
                      aria-label={`Change closing date: ${name}`}
                      onClick={() => setChanging(batch)}
                    >
                      Change…
                    </Button>
                  </span>
                </TableCell>
                <TableCell>
                  <BatchStatus batch={batch} />
                </TableCell>
                <TableCell actions>
                  <PreviewLink
                    batchId={batch.id}
                    label={`Preview a random transcript: ${name}`}
                  />
                  {batch.retiredAt ? (
                    <Button
                      size="small"
                      variant={ButtonVariant.Default}
                      aria-label={`Reactivate: ${name}`}
                      busy={actions.busyWith(batch, KoraBatchAction.Reactivate)}
                      disabled={pending}
                      onClick={() => actions.reactivate(batch)}
                    >
                      Reactivate
                    </Button>
                  ) : (
                    <Button
                      size="small"
                      variant={ButtonVariant.Default}
                      aria-label={`Retire: ${name}`}
                      busy={actions.busyWith(batch, KoraBatchAction.Retire)}
                      disabled={pending}
                      onClick={() => actions.retire(batch)}
                    >
                      Retire…
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      size="small"
                      variant={ButtonVariant.DangerOutline}
                      aria-label={`Delete: ${name}`}
                      busy={actions.busyWith(batch, KoraBatchAction.Delete)}
                      disabled={pending}
                      onClick={() => actions.remove(batch)}
                    >
                      Delete…
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {changing && (
        <ChangeClosingDateDialog
          batch={changing}
          onClose={() => setChanging(null)}
        />
      )}
    </>
  );
}

export function TranscriptsSection() {
  const batches = useKoraBatchesAdmin();
  const uploadRef = useRef<{ focus: () => void }>(null);
  return (
    <>
      <Panel title="Transcript batches" flush>
        <ContentState
          things="the batches"
          query={batches}
          skeleton={
            <TableSkeleton columns={7} rows={2} columnClassNames={COLUMNS} />
          }
          empty={batches.data?.length === 0}
          emptyTitle="No transcripts yet"
          emptyDescription="Upload KORA's file below. The project can be made Active once it has transcripts."
        >
          <BatchesTable batches={batches.data ?? []} uploadRef={uploadRef} />
        </ContentState>
      </Panel>
      <UploadBatchPanel ref={uploadRef} />
      <BatchHistoryPanel />
    </>
  );
}
