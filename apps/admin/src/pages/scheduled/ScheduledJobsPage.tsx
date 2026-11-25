import { withCount } from "@alliance/common/plural";
import { ChevronDown } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { Link } from "react-router";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { formatDateTime } from "../../lib/formatDate";
import { LAUNCH_TIME_ZONE } from "../../lib/launchTimeZone";
import { useScheduledPlansAdmin } from "../../lib/useScheduledPlansAdmin";
import { PlaceId } from "../../places";
import { AvatarProfile } from "../../ui/Avatar";
import Badge from "../../ui/Badge";
import Button, { ButtonVariant } from "../../ui/Button";
import { cn } from "../../ui/cn";
import { linkClass } from "../../ui/styles";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/Table";
import { Banner, BannerTone } from "../../ui/templates/Banner";
import { FilterBar, ListContent } from "../../ui/templates/List";
import { Page } from "../../ui/templates/Page";
import {
  ContentState,
  LOAD_FAILED_FALLBACK,
  TableSkeleton,
} from "../../ui/templates/States";
import {
  JOB_KIND_LABELS,
  memberHref,
  type ScheduledJob,
  scheduledJobs,
  taskHref,
} from "./scheduledJobRules";

const COLUMNS = 5;

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

  return (
    <Page
      fill
      place={PlaceId.ScheduledJobs}
      description="Member suspensions and forum task auto-completes the server will run in the next 7 days, soonest first."
      banner={
        plans.isRefetchError && (
          <Banner
            tone={BannerTone.Danger}
            action={
              <Button size="small" onClick={() => void plans.refetch()}>
                Try again
              </Button>
            }
          >
            {"Couldn't refresh scheduled jobs."}{" "}
            {adminRefusalMessage(plans.error, LOAD_FAILED_FALLBACK)} The list
            shows what loaded before.
          </Banner>
        )
      }
    >
      <FilterBar count={plans.data && withCount(jobs.length, "job")} />
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
          empty={jobs.length === 0}
          emptyTitle="No scheduled jobs"
          emptyDescription="No suspension or forum auto-complete is due in the next 7 days."
        >
          <Table bleed>
            <TableHeader>
              <TableRow>
                <TableHead className="w-64">When</TableHead>
                <TableHead className="w-48">Job</TableHead>
                <TableHead>Task</TableHead>
                <TableHead className="w-56">UTC</TableHead>
                <TableHead className="w-44 text-right">Members</TableHead>
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
  const when = formatDateTime(job.date, {
    weekday: true,
    timeZone: LAUNCH_TIME_ZONE,
  });
  const kind = JOB_KIND_LABELS[job.kind];
  const count = withCount(job.users.length, "member");
  return (
    <>
      <TableRow>
        <TableCell className="font-medium whitespace-nowrap">
          <time dateTime={job.date}>{when}</time>
        </TableCell>
        <TableCell>
          <Badge>{kind}</Badge>
        </TableCell>
        <TableCell className="max-w-64 truncate" title={job.task?.name}>
          {job.task ? (
            <Link to={taskHref(job.task)} className={linkClass}>
              {job.task.name}
            </Link>
          ) : (
            "—"
          )}
        </TableCell>
        <TableCell className="font-mono text-xs whitespace-nowrap text-fg-muted">
          {new Date(job.date).toISOString()}
        </TableCell>
        <TableCell>
          <Button
            variant={ButtonVariant.Ghost}
            size="small"
            className="ml-auto whitespace-nowrap tabular-nums"
            aria-expanded={expanded}
            aria-controls={expanded ? membersId : undefined}
            aria-label={`${count}: ${kind}, ${when}`}
            onClick={onToggle}
          >
            {count}
            <ChevronDown
              aria-hidden="true"
              className={cn(
                "size-4 text-fg-muted transition-transform duration-fast",
                expanded && "-rotate-180",
              )}
            />
          </Button>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell
            id={membersId}
            colSpan={COLUMNS}
            className="h-auto bg-surface-2 py-3"
          >
            {job.users.length === 0 ? (
              <p className="text-fg-muted">No members on this job.</p>
            ) : (
              <ul
                aria-label={`Members: ${kind}, ${when}`}
                className="grid grid-cols-2 gap-2 @4xl:grid-cols-3 @7xl:grid-cols-4"
              >
                {job.users.map((user) => (
                  <li key={user.id} className="min-w-0">
                    <Link
                      to={memberHref(user)}
                      className="flex items-center gap-2 rounded-md border border-line bg-surface px-2 py-1.5 font-medium focus-ring hover:border-line-strong"
                    >
                      <AvatarProfile
                        pfp={user.profilePicture}
                        size="small"
                        alt=""
                      />
                      <span className="truncate">{user.displayName}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
