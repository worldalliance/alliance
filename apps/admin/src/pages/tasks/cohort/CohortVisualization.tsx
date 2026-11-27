import type { CohortExpression } from "@alliance/common/cohort-expression";
import { Search } from "lucide-react";
import React, { useMemo, useRef, useState } from "react";
import { adminRefusalMessage } from "../../../lib/adminRefusal";
import { formatCount } from "../../../lib/formatNumber";
import { useCohortEvaluationAdmin } from "../../../lib/useCohortEvaluationAdmin";
import Badge from "../../../ui/Badge";
import { SERIES } from "../../../ui/charts/chartColor";
import { cn } from "../../../ui/cn";
import { Input } from "../../../ui/Input";
import { Skeleton } from "../../../ui/Skeleton";
import { popupClass } from "../../../ui/styles";
import type { UserSelectUser } from "../../../ui/UserSelect";

interface CohortVisualizationProps {
  expression: CohortExpression | null | undefined;
  selectedSubExpression: CohortExpression | null;
  users: UserSelectUser[];
  compareExpression?: CohortExpression | null;
  usersLoading?: boolean;
  usersError?: boolean;
}

export enum DotMatch {
  Highlighted = "highlighted",
  Both = "both",
  Cohort = "cohort",
  Compare = "compare",
  None = "none",
}

const BOTH_FILL = `repeating-linear-gradient(45deg, ${SERIES[0]} 0 25%, ${SERIES[1]} 25% 50%)`;

const DOT_LOOK: Record<DotMatch, { className: string; fill?: string }> = {
  [DotMatch.Highlighted]: { className: "bg-chart-4" },
  [DotMatch.Both]: { className: "", fill: BOTH_FILL },
  [DotMatch.Cohort]: { className: "bg-chart-1" },
  [DotMatch.Compare]: { className: "bg-chart-2" },
  [DotMatch.None]: { className: "bg-line-strong" },
};

const Swatch: React.FC<{ match: DotMatch }> = ({ match }) => (
  <span
    aria-hidden
    className={cn("size-2.5 shrink-0 rounded-full", DOT_LOOK[match].className)}
    style={{ background: DOT_LOOK[match].fill }}
  />
);

const LegendItem: React.FC<{ match?: DotMatch; children: React.ReactNode }> = ({
  match,
  children,
}) => (
  <span className="inline-flex items-center gap-1.5">
    {match && <Swatch match={match} />}
    {children}
  </span>
);

const Failure: React.FC<{ error: unknown; fallback: string }> = ({
  error,
  fallback,
}) => (
  <span role="alert" className="text-danger">
    {adminRefusalMessage(error, fallback)}
  </span>
);

const CohortVisualization: React.FC<CohortVisualizationProps> = ({
  expression,
  selectedSubExpression,
  users,
  compareExpression,
  usersLoading = false,
  usersError = false,
}) => {
  const {
    userIds: evaluatedIds,
    evaluating: loading,
    error: matchError,
  } = useCohortEvaluationAdmin(expression);
  const [settledIds, setSettledIds] = useState(evaluatedIds);
  if (!loading && settledIds !== evaluatedIds) setSettledIds(evaluatedIds);
  // The grid keeps the last result, dimmed, rather than flashing empty on each edit.
  const matchedIds = loading ? settledIds : evaluatedIds;
  const {
    userIds: subMatchedIds,
    evaluating: subLoading,
    error: subMatchError,
  } = useCohortEvaluationAdmin(selectedSubExpression);
  const {
    userIds: compareMatchedIds,
    evaluating: compareLoading,
    error: compareMatchError,
  } = useCohortEvaluationAdmin(compareExpression);
  const [searchQuery, setSearchQuery] = useState("");
  const [hovered, setHovered] = useState<{
    user: UserSelectUser;
    x: number;
    y: number;
  } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  // The grid unmounts on a failed evaluation, so no mouseleave clears the hover.
  if (matchError && hovered) setHovered(null);

  const inCohort = (id: number) => !!expression && matchedIds.has(id);
  const inCompare = (id: number) =>
    !!compareExpression && compareMatchedIds.has(id);
  const matchOf = (id: number): DotMatch =>
    selectedSubExpression && subMatchedIds.has(id)
      ? DotMatch.Highlighted
      : inCohort(id) && inCompare(id)
        ? DotMatch.Both
        : inCohort(id)
          ? DotMatch.Cohort
          : inCompare(id)
            ? DotMatch.Compare
            : DotMatch.None;

  const sortedUsers = useMemo(() => {
    const score = (id: number) => {
      const a = !!expression && matchedIds.has(id);
      const b = !!compareExpression && compareMatchedIds.has(id);
      return a && b ? 0 : a ? 1 : b ? 2 : 3;
    };
    return [...users].sort(
      (a, b) => score(a.id) - score(b.id) || a.name.localeCompare(b.name),
    );
  }, [users, matchedIds, compareMatchedIds, compareExpression, expression]);

  const countWhere = (test: (id: number) => boolean) =>
    users.filter((u) => test(u.id)).length;
  const matchCount = countWhere((id) => matchedIds.has(id));
  const subMatchCount = selectedSubExpression
    ? countWhere((id) => subMatchedIds.has(id))
    : 0;
  const compareMatchCount = countWhere(inCompare);
  const bothMatchCount = countWhere((id) => inCohort(id) && inCompare(id));

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return users.filter((u) => u.name.toLowerCase().includes(q)).slice(0, 5);
  }, [users, searchQuery]);
  const searchIds = new Set(searchResults.map((u) => u.id));

  if (usersLoading) {
    return (
      <div
        role="status"
        aria-label="Loading members"
        className="flex flex-col gap-2"
      >
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-control-sm w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }
  if (usersError) {
    return (
      <p role="alert" className="text-danger">
        Couldn&apos;t load members, so who matches can&apos;t be shown.
      </p>
    );
  }
  if (users.length === 0) {
    return <p className="text-fg-muted">No members to show.</p>;
  }

  const total = formatCount(users.length);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption font-medium text-fg-muted">
        {matchError ? (
          <Failure
            error={matchError}
            fallback="Couldn't evaluate the cohort."
          />
        ) : loading ? (
          <LegendItem>Evaluating…</LegendItem>
        ) : expression ? (
          <LegendItem match={DotMatch.Cohort}>
            {formatCount(matchCount)} of {total} members matched
          </LegendItem>
        ) : (
          <LegendItem>
            No conditions, so none of {total} members match
          </LegendItem>
        )}
        {subMatchError ? (
          <Failure
            error={subMatchError}
            fallback="Couldn't evaluate the highlighted condition."
          />
        ) : subLoading ? (
          <LegendItem>Evaluating highlighted condition…</LegendItem>
        ) : (
          selectedSubExpression && (
            <LegendItem match={DotMatch.Highlighted}>
              {formatCount(subMatchCount)} in highlighted condition
            </LegendItem>
          )
        )}
        {compareExpression &&
          (compareMatchError ? (
            <Failure
              error={compareMatchError}
              fallback="Couldn't evaluate the compared task's cohort."
            />
          ) : compareLoading ? (
            <LegendItem>Evaluating compared task…</LegendItem>
          ) : (
            <LegendItem match={DotMatch.Compare}>
              {formatCount(compareMatchCount)} in compared task
            </LegendItem>
          ))}
        {compareExpression &&
          expression &&
          !loading &&
          !compareLoading &&
          bothMatchCount > 0 && (
            <LegendItem match={DotMatch.Both}>
              {formatCount(bothMatchCount)} in both
            </LegendItem>
          )}
      </div>

      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-fg-muted"
        />
        <Input
          type="search"
          aria-label="Find a member"
          placeholder="Find a member"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-control-sm pl-8"
        />
      </div>
      {searchResults.length > 0 && (
        <ul aria-label="Members found" className="flex flex-col gap-1">
          {searchResults.map((user) => (
            <li key={user.id} className="flex items-center gap-2">
              <span className="font-medium">{user.name}</span>
              {!matchError && !loading && (
                <Badge>
                  {inCohort(user.id) ? "In cohort" : "Not in cohort"}
                </Badge>
              )}
              {selectedSubExpression && !subMatchError && !subLoading && (
                <Badge>
                  {subMatchedIds.has(user.id)
                    ? "In highlighted condition"
                    : "Not in highlighted condition"}
                </Badge>
              )}
              {compareExpression && !compareMatchError && !compareLoading && (
                <Badge>
                  {inCompare(user.id)
                    ? "In compared task"
                    : "Not in compared task"}
                </Badge>
              )}
            </li>
          ))}
        </ul>
      )}

      {!matchError && (
        <div
          ref={gridRef}
          role="img"
          aria-label="One dot per member, matched members first. Find a member above to see whether they match."
          className={cn(
            "relative flex flex-wrap gap-0.5 transition-opacity duration-base",
            loading && "opacity-40",
          )}
        >
          {sortedUsers.map((user) => {
            const match = matchOf(user.id);
            return (
              <span
                key={user.id}
                data-match={match}
                className={cn(
                  "size-2.5 rounded-full",
                  DOT_LOOK[match].className,
                  searchIds.has(user.id) && "ring-2 ring-fg ring-offset-1",
                )}
                style={{ background: DOT_LOOK[match].fill }}
                onMouseEnter={(e) => {
                  const rect = gridRef.current?.getBoundingClientRect();
                  if (rect)
                    setHovered({
                      user,
                      x: e.clientX - rect.left,
                      y: e.clientY - rect.top,
                    });
                }}
                onMouseLeave={() => setHovered(null)}
              />
            );
          })}
          {hovered && (
            <span
              className={cn(
                popupClass,
                "pointer-events-none absolute z-10 -translate-y-full px-2 py-1 text-caption whitespace-nowrap",
              )}
              style={{ left: hovered.x, top: hovered.y - 8 }}
            >
              {hovered.user.name}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default CohortVisualization;
