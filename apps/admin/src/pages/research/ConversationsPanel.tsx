import { CATEGORIES } from "@alliance/kora-review/categories";
import { formatDuration, intervalToDuration } from "date-fns";
import { formatDateTime } from "../../lib/formatDate";
import { useKoraConversationsAdmin } from "../../lib/useKoraBatchesAdmin";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/Table";
import { Panel } from "../../ui/templates/Overview";
import {
  ContentState,
  RefreshFailedBanner,
  TableSkeleton,
} from "../../ui/templates/States";

const NUM = "text-right tabular-nums whitespace-nowrap";
const COLUMNS = [undefined, undefined, undefined, NUM, NUM, NUM, NUM];

const label = (id: string) => CATEGORIES.find((c) => c.id === id)?.label ?? id;

const duration = (ms: number | null) =>
  ms === null
    ? "—"
    : formatDuration(intervalToDuration({ start: 0, end: ms }), {
        format: ["hours", "minutes", "seconds"],
      }) || "0 seconds";

export function ConversationsPanel() {
  const conversations = useKoraConversationsAdmin();
  return (
    <Panel title="Conversations" flush>
      <RefreshFailedBanner
        things="the conversations"
        query={conversations}
        inline
      />
      <p className="border-b border-line px-card py-3 text-fg-muted">
        Every uploaded conversation, newest batch first. Reviews counts finished
        reviews against the batch's target. Times are how long finished reviews
        had the conversation open while the page was visible.
      </p>
      <ContentState
        things="the conversations"
        query={conversations}
        refreshBanner={false}
        skeleton={<TableSkeleton columns={7} columnClassNames={COLUMNS} />}
        empty={conversations.data?.length === 0}
        emptyTitle="No conversations yet"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Conversation</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Uploaded</TableHead>
              <TableHead className={NUM}>Reviews</TableHead>
              <TableHead className={NUM}>Median time</TableHead>
              <TableHead className={NUM}>Fastest</TableHead>
              <TableHead className={NUM}>Slowest</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(conversations.data ?? []).map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-xs">{c.id}</TableCell>
                <TableCell>{label(c.category)}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {formatDateTime(c.uploadedAt)}
                </TableCell>
                <TableCell className={NUM}>
                  {c.reviews} of {c.reviewsPerTranscript}
                </TableCell>
                <TableCell className={NUM}>
                  {duration(c.medianTimeMs)}
                </TableCell>
                <TableCell className={NUM}>{duration(c.minTimeMs)}</TableCell>
                <TableCell className={NUM}>{duration(c.maxTimeMs)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ContentState>
    </Panel>
  );
}
