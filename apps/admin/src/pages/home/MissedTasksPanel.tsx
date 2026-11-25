import { useState } from "react";
import { href, Link } from "react-router";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { formatCount } from "../../lib/formatNumber";
import { useMissedActionsAdmin } from "../../lib/useMissedActionsAdmin";
import Button, { ButtonVariant } from "../../ui/Button";
import { cn } from "../../ui/cn";
import { Skeleton } from "../../ui/Skeleton";
import { linkClass } from "../../ui/styles";
import { Panel } from "../../ui/templates/Overview";
import { ContentState, LOAD_FAILED_FALLBACK } from "../../ui/templates/States";
import { PanelNote } from "./chartParts";

type Missed = NonNullable<ReturnType<typeof useMissedActionsAdmin>["data"]>;

function MemberGroup({
  title,
  members,
}: {
  title: string;
  members: Missed["missedLastAction"];
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="font-semibold">{title}</h4>
        <span className="text-title font-semibold tabular-nums">
          {formatCount(members.length)}
        </span>
      </div>
      {members.length === 0 ? (
        <PanelNote>No members.</PanelNote>
      ) : (
        <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
          {members.map((member) => (
            <li key={member.userId} className="flex justify-between gap-3">
              <Link
                to={href("/members/:userId", {
                  userId: member.userId.toString(),
                })}
                className={cn(linkClass, "min-w-0 truncate")}
              >
                {member.name}
              </Link>
              <span className="shrink-0 text-caption text-fg-muted">
                {member.lastActionName}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Loaded only when asked for; each later press loads it again. */
export function MissedTasksPanel({ className }: { className?: string }) {
  const [requested, setRequested] = useState(false);
  const missed = useMissedActionsAdmin({ enabled: requested });
  const load = () => {
    if (requested) void missed.refetch();
    else setRequested(true);
  };

  return (
    <Panel
      title="Recent missed tasks"
      className={className}
      action={
        <Button
          variant={ButtonVariant.Default}
          size="small"
          busy={missed.isFetching}
          onClick={load}
        >
          View members
        </Button>
      }
    >
      {!requested ? (
        <PanelNote>
          Active members whose most recent completed non-optional task was
          missed. Select View members to load them.
        </PanelNote>
      ) : (
        <ContentState
          loading={missed.isFetching && (!missed.data || missed.isError)}
          skeleton={<Skeleton className="h-24 w-full" />}
          error={
            missed.error && !missed.isFetching
              ? adminRefusalMessage(missed.error, LOAD_FAILED_FALLBACK)
              : null
          }
          errorTitle="Couldn't load missed tasks"
          onRetry={load}
          empty={!missed.data}
          emptyTitle="No missed tasks"
        >
          {missed.data && (
            <div className="grid grid-cols-2 gap-x-10 gap-y-4">
              <MemberGroup
                title="Missed last task"
                members={missed.data.missedLastAction}
              />
              <MemberGroup
                title="Missed last two tasks"
                members={missed.data.missedLastTwoActions}
              />
            </div>
          )}
        </ContentState>
      )}
    </Panel>
  );
}
