import type { CohortExpression } from "@alliance/common/cohort-expression";
import { cn } from "@alliance/shared/styles/util";
import type { UserSelectUser } from "@alliance/sharedweb/ui/UserSelect";
import { Search } from "lucide-react";
import React, { useMemo, useRef, useState } from "react";
import { adminRefusalMessage } from "../lib/adminRefusal";
import type { BranchRouting } from "../lib/useBranchRoutingPreviewAdmin";
import { useCohortEvaluationAdmin } from "../lib/useCohortEvaluationAdmin";

interface CohortVisualizationProps {
  expression: CohortExpression | null | undefined;
  selectedSubExpression: CohortExpression | null;
  users: UserSelectUser[];
  compareExpression?: CohortExpression | null;
  /** On a branch's rule: the members routed to it. The rest it matches show lighter. */
  routing?: BranchRouting;
}

const DOT_SIZE = 10;
const DOT_GAP = 3;

const CohortVisualization: React.FC<CohortVisualizationProps> = ({
  expression,
  selectedSubExpression,
  users,
  compareExpression,
  routing,
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
  const [hoveredUser, setHoveredUser] = useState<UserSelectUser | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const containerRef = useRef<HTMLDivElement>(null);
  // The grid unmounts on a failed evaluation, so no mouseleave clears the hover.
  if (matchError && hoveredUser) setHoveredUser(null);

  const isRouted = (userId: number) => !routing || routing.userIds.has(userId);

  const sortedUsers = useMemo(() => {
    const routedFirst = (userId: number) =>
      routing && !routing.userIds.has(userId) ? 1 : 0;
    return [...users].sort((a, b) => {
      const routedOrder = routedFirst(a.id) - routedFirst(b.id);
      const aMatch = matchedIds.has(a.id);
      const bMatch = matchedIds.has(b.id);
      const aCompare = compareExpression ? compareMatchedIds.has(a.id) : false;
      const bCompare = compareExpression ? compareMatchedIds.has(b.id) : false;

      // Sort priority: both > current only > compare only > neither
      const aScore = aMatch && aCompare ? 0 : aMatch ? 1 : aCompare ? 2 : 3;
      const bScore = bMatch && bCompare ? 0 : bMatch ? 1 : bCompare ? 2 : 3;
      if (aScore !== bScore) return aScore - bScore;
      if (routedOrder !== 0) return routedOrder;
      return a.name.localeCompare(b.name);
    });
  }, [users, matchedIds, compareMatchedIds, compareExpression, routing]);

  const matchCount = useMemo(
    () => users.filter((u) => matchedIds.has(u.id)).length,
    [users, matchedIds],
  );

  const routedCount = useMemo(
    () =>
      routing
        ? users.filter((u) => matchedIds.has(u.id) && routing.userIds.has(u.id))
            .length
        : 0,
    [users, matchedIds, routing],
  );

  const subMatchCount = useMemo(
    () =>
      selectedSubExpression
        ? users.filter((u) => subMatchedIds.has(u.id)).length
        : 0,
    [users, subMatchedIds, selectedSubExpression],
  );

  const compareMatchCount = useMemo(
    () =>
      compareExpression
        ? users.filter((u) => compareMatchedIds.has(u.id)).length
        : 0,
    [users, compareMatchedIds, compareExpression],
  );

  const bothMatchCount = useMemo(
    () =>
      compareExpression && expression
        ? users.filter(
            (u) => matchedIds.has(u.id) && compareMatchedIds.has(u.id),
          ).length
        : 0,
    [users, matchedIds, compareMatchedIds, compareExpression, expression],
  );

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return users.filter((u) => u.name.toLowerCase().includes(q)).slice(0, 5);
  }, [users, searchQuery]);

  const searchMatchIds = useMemo(
    () => new Set(searchResults.map((u) => u.id)),
    [searchResults],
  );

  if (users.length === 0) {
    return <p className="text-xs text-gray-400 italic">No members loaded.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
        <span>
          {matchError ? (
            <span className="text-red-600">
              {adminRefusalMessage(
                matchError,
                "Failed to evaluate the cohort.",
              )}
            </span>
          ) : loading ? (
            "Evaluating..."
          ) : expression && routing ? (
            routing.error ? (
              <span className="text-red-600">
                {adminRefusalMessage(
                  routing.error,
                  "Failed to preview the branch routing.",
                )}
              </span>
            ) : routing.evaluating ? (
              "Previewing routing..."
            ) : (
              <span className="flex gap-3">
                <span>
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 mr-1 align-middle" />
                  {routedCount} of {users.length} routed to this branch
                </span>
                <span>
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500/30 mr-1 align-middle" />
                  {matchCount - routedCount} match its rule but go elsewhere
                </span>
              </span>
            )
          ) : expression ? (
            <>
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 mr-1 align-middle" />
              {matchCount} of {users.length} members matched
            </>
          ) : (
            <>All {users.length} members (no expression)</>
          )}
        </span>
        {subMatchError ? (
          <span className="text-red-600">
            {adminRefusalMessage(
              subMatchError,
              "Failed to evaluate the selected condition.",
            )}
          </span>
        ) : subLoading ? (
          <span>Evaluating selected condition...</span>
        ) : (
          selectedSubExpression &&
          subMatchCount > 0 && (
            <span>
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500 mr-1 align-middle" />
              {subMatchCount} in selected condition
            </span>
          )
        )}
        {compareExpression && (
          <>
            {compareMatchError ? (
              <span className="text-red-600">
                {adminRefusalMessage(
                  compareMatchError,
                  "Failed to evaluate the compare action's cohort.",
                )}
              </span>
            ) : compareLoading ? (
              <span>Evaluating compare action...</span>
            ) : (
              <span>
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-violet-500 mr-1 align-middle" />
                {compareMatchCount} in compare action
              </span>
            )}
            {expression && !loading && bothMatchCount > 0 && (
              <span>
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full mr-1 align-middle"
                  style={{
                    background:
                      "repeating-linear-gradient(45deg, #10b981, #10b981 2px, #8b5cf6 2px, #8b5cf6 4px)",
                  }}
                />
                {bothMatchCount} in both
              </span>
            )}
          </>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
        <input
          type="text"
          placeholder="Search for a user..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-7 pr-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 bg-zinc-50"
        />
      </div>
      {searchResults.length > 0 && (
        <div className="space-y-1">
          {searchResults.map((user) => {
            const inCohort = expression ? matchedIds.has(user.id) : false;
            const inCompare =
              compareExpression && compareMatchedIds.has(user.id);
            return (
              <div
                key={user.id}
                className="flex items-center gap-2 text-sm px-1"
              >
                <span className="font-medium text-gray-700">{user.name}</span>
                {!matchError &&
                  !loading &&
                  (expression ? (
                    <span
                      className={cn(
                        "text-xs px-1.5 py-0.5 rounded-full",
                        inCohort && isRouted(user.id)
                          ? "bg-emerald-100 text-emerald-700"
                          : inCohort
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-gray-100 text-gray-500",
                      )}
                    >
                      {!inCohort
                        ? routing
                          ? "doesn't match"
                          : "not in cohort"
                        : !routing
                          ? "in cohort"
                          : isRouted(user.id)
                            ? "routed here"
                            : "matches, goes elsewhere"}
                    </span>
                  ) : (
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                      no expression
                    </span>
                  ))}
                {compareExpression && !compareMatchError && !compareLoading && (
                  <span
                    className={cn(
                      "text-xs px-1.5 py-0.5 rounded-full",
                      inCompare
                        ? "bg-violet-100 text-violet-700"
                        : "bg-gray-100 text-gray-500",
                    )}
                  >
                    {inCompare ? "in compare" : "not in compare"}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!matchError && (
        <div
          ref={containerRef}
          className={cn("relative flex flex-wrap", loading && "opacity-40")}
          style={{ gap: `${DOT_GAP}px` }}
        >
          {sortedUsers.map((user) => {
            const isMatched = expression ? matchedIds.has(user.id) : false;
            const isSubMatched =
              selectedSubExpression && subMatchedIds.has(user.id);
            const isCompareMatched =
              compareExpression && compareMatchedIds.has(user.id);

            let bgColor: string | undefined;
            let bgStyle: React.CSSProperties | undefined;

            if (isSubMatched) {
              bgColor = "bg-blue-500";
            } else if (isMatched && isCompareMatched) {
              bgStyle = {
                background:
                  "repeating-linear-gradient(45deg, #10b981, #10b981 2px, #8b5cf6 2px, #8b5cf6 4px)",
              };
            } else if (isMatched) {
              bgColor = isRouted(user.id)
                ? "bg-emerald-500"
                : "bg-emerald-500/30";
            } else if (isCompareMatched) {
              bgColor = "bg-violet-500";
            } else {
              bgColor = "bg-gray-200";
            }

            return (
              <div
                key={user.id}
                className={cn(
                  "rounded-full cursor-default transition-colors",
                  bgColor,
                  searchQuery &&
                    searchMatchIds.has(user.id) &&
                    "ring-2 ring-gray-800 ring-offset-1",
                )}
                style={{
                  width: `${DOT_SIZE}px`,
                  height: `${DOT_SIZE}px`,
                  ...bgStyle,
                }}
                onMouseEnter={(e) => {
                  setHoveredUser(user);
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (rect) {
                    setTooltipPos({
                      x: e.clientX - rect.left,
                      y: e.clientY - rect.top,
                    });
                  }
                }}
                onMouseLeave={() => setHoveredUser(null)}
              />
            );
          })}

          {hoveredUser && (
            <div
              className="absolute z-10 px-2 py-1 text-xs font-medium text-white bg-gray-800 rounded shadow-lg pointer-events-none whitespace-nowrap"
              style={{
                left: tooltipPos.x,
                top: tooltipPos.y - 28,
              }}
            >
              {hoveredUser.name}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CohortVisualization;
