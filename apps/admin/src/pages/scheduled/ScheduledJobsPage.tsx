import { useId, useMemo, useState } from "react";
import { Link } from "react-router";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { countOf } from "../../lib/formatNumber";
import { taskHref } from "../../lib/hrefs";
import { useScheduledPlansAdmin } from "../../lib/useScheduledPlansAdmin";
import { PlaceId } from "../../places";
import Badge from "../../ui/Badge";
import { PersonChip } from "../../ui/PersonCell";
import { linkClass } from "../../ui/styles";
import {
  ExpandToggle,
  Table,
  TableBody,
  TableCell,
  TableDetailRow,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/Table";
import { ListContent, listCount } from "../../ui/templates/List";
import { Page } from "../../ui/templates/Page";
import {
  ContentState,
  LOAD_FAILED_FALLBACK,
  RefreshFailedBanner,
  TableSkeleton,
} from "../../ui/templates/States";
import {
  JOB_KIND_LABELS,
  jobWhen,
  type ScheduledJob,
  scheduledJobs,
} from "./scheduledJobRules";

const COLUMNS = 4;

export default function ScheduledJobsPage() {
  const plans = useScheduledPlansAdmin();
  const jobs = useMemo(
    () => (plans.data ? scheduledJobs(plans.data) : []),
    [plans.data],
  );
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  const count = listCount({
    shown: jobs.length,
    total: plans.data && jobs.length,
    noun: "job",
  });

  return (
    <Page
      fill
      place={PlaceId.ScheduledJobs}
      description={`Member suspensions and forum task auto-completes due in the next 7 days, soonest first.${count ? ` ${count}.` : ""}`}
      banner={<RefreshFailedBanner things="scheduled jobs" query={plans} />}
    >
      <ListContent>
        <ContentState
          loading={plans.isPending}
          skeleton={<TableSkeleton bleed columns={COLUMNS} />}
          error={
            plans.isLoadingError
              ? adminRefusalMessage(plans.error, LOAD_FAILED_FALLBACK)
              : null
          }
          errorTitle="Couldn't load scheduled jobs"
          onRetry={() => void plans.refetch()}
          retrying={plans.isFetching}
          empty={jobs.length === 0}
          emptyTitle="No scheduled jobs"
          emptyDescription="No member is due a suspension or a forum auto-complete in the next 7 days."
        >
          <Table bleed>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Job</TableHead>
                <TableHead>Task</TableHead>
                <TableHead>Members</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <JobRows
                  key={job.key}
                  job={job}
                  expanded={expanded.has(job.key)}
                  onToggle={() => toggle(job.key)}
                />
              ))}
            </TableBody>
          </Table>
        </ContentState>
      </ListContent>
    </Page>
  );
}

function JobRows({
  job,
  expanded,
  onToggle,
}: {
  job: ScheduledJob;
  expanded: boolean;
  onToggle: () => void;
}) {
  const membersId = useId();
  const when = jobWhen(job);
  const kind = JOB_KIND_LABELS[job.kind];
  const members = countOf(job.users.length, "member");
  return (
    <>
      <TableRow>
        <TableCell className="font-medium whitespace-nowrap">
          <time dateTime={job.date} title={when.detail}>
            {when.text}
          </time>
        </TableCell>
        <TableCell>
          <Badge>{kind}</Badge>
        </TableCell>
        <TableCell truncate title={job.task?.name}>
          {job.task ? (
            <Link to={taskHref(job.task.id)} className={linkClass}>
              {job.task.name}
            </Link>
          ) : (
            "—"
          )}
        </TableCell>
        <TableCell>
          <ExpandToggle
            expanded={expanded}
            controls={membersId}
            onToggle={onToggle}
            aria-label={`${members}: ${kind}, ${when.text}`}
          >
            <span className="tabular-nums">{members}</span>
          </ExpandToggle>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableDetailRow id={membersId} colSpan={COLUMNS}>
          <ul
            aria-label={`Members: ${kind}, ${when.text}`}
            className="grid grid-cols-2 gap-x-6 gap-y-2 @4xl:grid-cols-3 @7xl:grid-cols-4"
          >
            {job.users.map((user) => (
              <li key={user.id} className="flex min-w-0">
                <PersonChip
                  userId={user.id}
                  name={user.displayName}
                  profilePicture={user.profilePicture}
                  link
                />
              </li>
            ))}
          </ul>
        </TableDetailRow>
      )}
    </>
  );
}
