import type {
  ActionActivityType,
  UserActionRelationPillStatus,
} from "@alliance/shared/client/types.gen";
import { keyBy } from "es-toolkit";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { WithdrawalInfo } from "../../components/WithdrawalInfo";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { formatDate } from "../../lib/formatDate";
import { formatCount } from "../../lib/formatNumber";
import { taskHref } from "../../lib/hrefs";
import { useConfirmOnPage } from "../../lib/useConfirmOnPage";
import { useUserActionRelationsAdmin } from "../../lib/useUserActionRelationsAdmin";
import Badge, { BadgeTone } from "../../ui/Badge";
import { cn } from "../../ui/cn";
import { MoreMenu } from "../../ui/MoreMenu";
import PhaseBadge from "../../ui/PhaseBadge";
import { nameLinkClass } from "../../ui/styles";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/Table";
import { Panel } from "../../ui/templates/Overview";
import { ContentState, TableSkeleton } from "../../ui/templates/States";
import { useToast } from "../../ui/ToastProvider";
import type { MemberErrorReporting } from "./memberRules";

export const TASK_STANDING: Record<
  UserActionRelationPillStatus,
  { label: string; tone: BadgeTone }
> = {
  completed: { label: "Completed", tone: BadgeTone.Success },
  todo: { label: "Not started", tone: BadgeTone.Neutral },
  wont_complete: { label: "Won't complete", tone: BadgeTone.Warning },
  missed_deadline: { label: "Missed deadline", tone: BadgeTone.Danger },
  away: { label: "Away", tone: BadgeTone.Neutral },
  not_required: { label: "Not required", tone: BadgeTone.Neutral },
  optional_task: { label: "Optional", tone: BadgeTone.Info },
};

// The two a member's record can be given by staff; the server keeps the others
// for the member's own app.
const RECORDABLE: Record<ActionActivityType, string | null> = {
  user_completed: "Completed",
  user_wont_complete: "Won't complete",
  user_dismissed: null,
  user_submitted_follow_up_form: null,
};

const isRecordable = (value: string): value is ActionActivityType =>
  value in RECORDABLE;

const RECORD_OPTIONS = Object.entries(RECORDABLE).flatMap(([type, label]) =>
  label === null || !isRecordable(type) ? [] : [{ type, label }],
);

// A name keeps enough width to read, and the phase and last activity sit under
// the name and status, so the table fits beside the side panel at 1280 px.
const NAME_COLUMN = "min-w-72";

/** The member's standing on every task, and recording an activity for them. */
export function MemberTasksTab({
  member,
  reportError,
  clearError,
}: MemberErrorReporting & { member: { id: number; name: string } }) {
  const { query, createActivity } = useUserActionRelationsAdmin(member.id);
  const confirm = useConfirmOnPage();
  const { success } = useToast();
  const [recordingFor, setRecordingFor] = useState<number | null>(null);

  const relationByTaskId = useMemo(
    () =>
      keyBy(query.data?.actionRelations ?? [], (relation) => relation.actionId),
    [query.data?.actionRelations],
  );
  const tasks = query.data?.actionSummaries ?? [];

  // From the server's adminCreateActivity: saved as a staff override with none
  // of the checks a member's own activity passes, counted at once, and there
  // is no endpoint that removes one.
  const record = async (params: {
    task: { id: number; name: string };
    type: ActionActivityType;
  }) => {
    const { task, type } = params;
    const label = RECORDABLE[type];
    const confirmed = await confirm({
      title: `Record “${label}” for ${member.name}?`,
      message: `On the task “${task.name}”. It is saved as a staff override, skipping the checks the member's own app makes, and counts in the task's totals at once. The admin can't remove it afterwards.`,
      confirmLabel: "Record activity",
    });
    if (!confirmed) return;
    clearError();
    setRecordingFor(task.id);
    try {
      await createActivity.mutateAsync({ actionId: task.id, type });
      success("Activity recorded", task.name);
    } catch (error) {
      reportError(adminRefusalMessage(error, "Couldn't record the activity."));
    } finally {
      setRecordingFor(null);
    }
  };

  return (
    <Panel
      title="Tasks"
      description={query.data ? formatCount(tasks.length) : undefined}
      flush
    >
      <ContentState
        things="tasks"
        query={query}
        skeleton={
          <TableSkeleton
            columns={3}
            rows={6}
            columnClassNames={[NAME_COLUMN]}
          />
        }
        empty={tasks.length === 0}
        emptyTitle="No tasks yet"
        emptyDescription="Tasks appear here once one is launched to this member."
      >
        <Table stickyActions>
          <TableHeader>
            <TableRow>
              <TableHead className={NAME_COLUMN}>Task</TableHead>
              <TableHead>Member's status</TableHead>
              <TableHead actions>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task) => {
              // A member can have no record for a task they were never given.
              const relation = relationByTaskId[task.id];
              const standing = relation && TASK_STANDING[relation.status];
              const badge = standing && (
                <Badge tone={standing.tone}>{standing.label}</Badge>
              );
              return (
                <TableRow key={task.id}>
                  <TableCell truncate title={task.name} className={NAME_COLUMN}>
                    <div className="flex flex-col items-start gap-1 py-2">
                      <Link
                        to={taskHref(task.id)}
                        className={cn(nameLinkClass, "max-w-full truncate")}
                      >
                        {task.name}
                      </Link>
                      <PhaseBadge status={task.status} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-0.5">
                      {!relation ? (
                        "—"
                      ) : relation.status === "wont_complete" ? (
                        <WithdrawalInfo
                          withdrawal={relation}
                          trigger={
                            <button
                              type="button"
                              className="cursor-default rounded-full focus-ring"
                              aria-label="Won't complete: show the reason"
                            >
                              {badge}
                            </button>
                          }
                        />
                      ) : (
                        badge
                      )}
                      {relation?.latestActivityAt && (
                        <span className="text-caption text-fg-muted">
                          Last activity {formatDate(relation.latestActivityAt)}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell actions>
                    <MoreMenu
                      compact
                      size="small"
                      subject={task.name}
                      busy={recordingFor === task.id}
                      items={RECORD_OPTIONS.map((option) => ({
                        label: `Record “${option.label}”…`,
                        onSelect: () =>
                          void record({ task, type: option.type }),
                        disabledReason:
                          recordingFor === null
                            ? undefined
                            : "Another activity is being recorded",
                      }))}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </ContentState>
    </Panel>
  );
}
