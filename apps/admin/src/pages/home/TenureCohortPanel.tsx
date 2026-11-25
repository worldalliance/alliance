import { max } from "d3";
import { useState } from "react";
import { formatCount } from "../../lib/formatNumber";
import { useAppliedQuery } from "../../lib/useAppliedQuery";
import { usePlatformTenureCohortAdmin } from "../../lib/usePlatformTenureCohortAdmin";
import Button, { ButtonVariant } from "../../ui/Button";
import { Skeleton } from "../../ui/Skeleton";
import {
  NumberField,
  Panel,
  PanelControls,
  PanelNote,
  PanelStack,
  PanelStat,
} from "../../ui/templates/Overview";
import { ContentState, LOAD_FAILED_FALLBACK } from "../../ui/templates/States";

const SHOWN_TASKS = 12;
const percent = (rate: number, digits: number) =>
  `${(rate * 100).toFixed(digits)}%`;

type Cohort = NonNullable<
  ReturnType<typeof usePlatformTenureCohortAdmin>["data"]
>;

/** An empty cohort has no rate, not a rate of zero. */
const rateOf = (cohort: Cohort, rate: number) =>
  cohort.cohortSize > 0 ? percent(rate, 1) : "—";

function CohortTasks({ actions }: { actions: Cohort["actions"] }) {
  const mostAssigned = Math.max(
    max(actions, (action) => action.assignedCount) ?? 0,
    1,
  );
  return (
    <ul className="flex flex-col gap-2">
      {actions.slice(0, SHOWN_TASKS).map((action) => {
        const assigned = (action.assignedCount / mostAssigned) * 100;
        const completed =
          action.assignedCount > 0
            ? (action.completedCount / action.assignedCount) * assigned
            : 0;
        return (
          <li key={action.actionId} className="flex items-center gap-3">
            <span className="w-36 shrink-0 truncate" title={action.actionName}>
              {action.actionName}
            </span>
            <span
              aria-hidden="true"
              className="relative h-5 min-w-16 flex-1 overflow-hidden rounded-sm bg-surface-2"
            >
              <span
                className="absolute inset-y-0 left-0 bg-line-strong"
                style={{ width: `${assigned}%` }}
              />
              <span
                className="absolute inset-y-0 left-0 bg-chart-1"
                style={{ width: `${completed}%` }}
              />
            </span>
            <span className="shrink-0 text-right whitespace-nowrap text-fg-muted tabular-nums">
              {formatCount(action.completedCount)}/
              {formatCount(action.assignedCount)} (
              {percent(action.completionRate, 0)})
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** The members who first joined exactly N weeks ago. Loaded when asked for. */
export function TenureCohortPanel({ className }: { className?: string }) {
  const [weeksInput, setWeeksInput] = useState("4");
  const [weeksError, setWeeksError] = useState<string | null>(null);
  const cohort = useAppliedQuery({
    useQueryFor: usePlatformTenureCohortAdmin,
    loadErrorFallback: LOAD_FAILED_FALLBACK,
  });
  const [asked, setAsked] = useState(false);

  const view = () => {
    const weeks = Number(weeksInput);
    if (!Number.isInteger(weeks) || weeks < 0) {
      setWeeksError("Weeks on platform must be a whole number.");
      return;
    }
    setWeeksError(null);
    setAsked(true);
    cohort.apply(weeks);
  };

  return (
    <Panel
      title="Task completion and churn after joining"
      className={className}
    >
      <PanelStack>
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            view();
          }}
        >
          <PanelControls
            actions={
              <Button
                type="submit"
                variant={ButtonVariant.Default}
                size="small"
                busy={cohort.loading}
              >
                View cohort
              </Button>
            }
          >
            <NumberField
              label="Weeks after joining"
              help="Joined exactly this many weeks ago."
              min={0}
              value={weeksInput}
              onChange={setWeeksInput}
              error={weeksError}
            />
          </PanelControls>
        </form>
        {!asked ? (
          <PanelNote>Select View cohort to load the cohort.</PanelNote>
        ) : (
          <ContentState
            loading={cohort.loading && !cohort.data}
            skeleton={<Skeleton className="h-16 w-full" />}
            error={cohort.loadError}
            errorTitle="Couldn't load this cohort"
            onRetry={view}
            empty={!cohort.data}
            emptyTitle="No cohort for these weeks"
          >
            {cohort.data && (
              <>
                <div className="grid grid-cols-3 gap-x-6 gap-y-4">
                  <PanelStat
                    label="Cohort size"
                    value={formatCount(cohort.data.cohortSize)}
                  />
                  <PanelStat
                    label="Task completion"
                    value={rateOf(cohort.data, cohort.data.completionRate)}
                  />
                  <PanelStat
                    label="Churn rate"
                    value={rateOf(cohort.data, cohort.data.churnRate)}
                  />
                  <PanelStat
                    label="Active / churned"
                    value={`${formatCount(cohort.data.activeCount)} / ${formatCount(cohort.data.churnedCount)}`}
                  />
                  <PanelStat
                    label="Completed"
                    value={formatCount(cohort.data.completedCount)}
                  />
                  <PanelStat
                    label="Assigned"
                    value={formatCount(cohort.data.assignedCount)}
                  />
                </div>
                {cohort.data.actions.length === 0 ? (
                  <PanelNote>
                    No assigned reliability tasks for this cohort.
                  </PanelNote>
                ) : (
                  <CohortTasks actions={cohort.data.actions} />
                )}
              </>
            )}
          </ContentState>
        )}
      </PanelStack>
    </Panel>
  );
}
