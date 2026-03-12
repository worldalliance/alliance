import React, { useEffect, useMemo, useRef, useState } from "react";
import { actionsEvaluateCohort } from "@alliance/shared/client";
import type { CohortExpression } from "@alliance/shared/cohort-expression.types";
import type { UserSelectUser } from "@alliance/sharedweb/ui/UserSelect";
import { cn } from "@alliance/shared/styles/util";

interface CohortVisualizationProps {
  expression: CohortExpression | null | undefined;
  selectedSubExpression: CohortExpression | null;
  users: UserSelectUser[];
}

const DOT_SIZE = 10;
const DOT_GAP = 3;

const CohortVisualization: React.FC<CohortVisualizationProps> = ({
  expression,
  selectedSubExpression,
  users,
}) => {
  const [matchedIds, setMatchedIds] = useState<Set<number>>(new Set());
  const [subMatchedIds, setSubMatchedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [hoveredUser, setHoveredUser] = useState<UserSelectUser | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const containerRef = useRef<HTMLDivElement>(null);

  // Evaluate full expression
  useEffect(() => {
    if (!expression) {
      setMatchedIds(new Set());
      return;
    }
    let cancelled = false;
    setLoading(true);
    actionsEvaluateCohort({
      body: { expression: expression as unknown as Record<string, unknown> },
    })
      .then((res) => {
        if (!cancelled && res.data) {
          setMatchedIds(new Set(res.data.userIds));
        }
      })
      .catch(() => {
        if (!cancelled) setMatchedIds(new Set());
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [expression]);

  // Evaluate sub-expression
  useEffect(() => {
    if (!selectedSubExpression) {
      setSubMatchedIds(new Set());
      return;
    }
    let cancelled = false;
    actionsEvaluateCohort({
      body: {
        expression:
          selectedSubExpression as unknown as Record<string, unknown>,
      },
    })
      .then((res) => {
        if (!cancelled && res.data) {
          setSubMatchedIds(new Set(res.data.userIds));
        }
      })
      .catch(() => {
        if (!cancelled) setSubMatchedIds(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSubExpression]);

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      const aMatch = matchedIds.has(a.id) ? 0 : 1;
      const bMatch = matchedIds.has(b.id) ? 0 : 1;
      if (aMatch !== bMatch) return aMatch - bMatch;
      return a.name.localeCompare(b.name);
    });
  }, [users, matchedIds]);

  const matchCount = useMemo(
    () => users.filter((u) => matchedIds.has(u.id)).length,
    [users, matchedIds]
  );

  const subMatchCount = useMemo(
    () =>
      selectedSubExpression
        ? users.filter((u) => subMatchedIds.has(u.id)).length
        : 0,
    [users, subMatchedIds, selectedSubExpression]
  );

  if (users.length === 0) {
    return (
      <p className="text-xs text-gray-400 italic">No members loaded.</p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 text-xs text-gray-500">
        <span>
          {loading ? (
            "Evaluating..."
          ) : expression ? (
            <>
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 mr-1 align-middle" />
              {matchCount} of {users.length} members matched
            </>
          ) : (
            <>All {users.length} members (no expression)</>
          )}
        </span>
        {selectedSubExpression && subMatchCount > 0 && (
          <span>
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500 mr-1 align-middle" />
            {subMatchCount} in selected condition
          </span>
        )}
      </div>

      <div
        ref={containerRef}
        className="relative flex flex-wrap"
        style={{ gap: `${DOT_GAP}px` }}
      >
        {sortedUsers.map((user) => {
          const isMatched = !expression || matchedIds.has(user.id);
          const isSubMatched =
            selectedSubExpression && subMatchedIds.has(user.id);

          let bgColor: string;
          if (isSubMatched) {
            bgColor = "bg-blue-500";
          } else if (isMatched) {
            bgColor = "bg-emerald-500";
          } else {
            bgColor = "bg-gray-200";
          }

          return (
            <div
              key={user.id}
              className={cn(
                "rounded-full cursor-default transition-colors",
                bgColor
              )}
              style={{
                width: `${DOT_SIZE}px`,
                height: `${DOT_SIZE}px`,
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
    </div>
  );
};

export default CohortVisualization;
