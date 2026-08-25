import { withCount } from "@alliance/common/plural";
import {
  actionsScheduledPlansAdmin,
  ScheduledPlansOverviewDto,
} from "@alliance/shared/client";
import { cn } from "@alliance/shared/styles/util";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import Card from "@alliance/sharedweb/ui/Card";
import CenterLayout from "@alliance/sharedweb/ui/CenterLayout";
import Spinner from "@alliance/sharedweb/ui/Spinner";
import { ChevronDown, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

const ScheduledPlansPage = () => {
  const [plans, setPlans] = useState<ScheduledPlansOverviewDto | null>(null);
  const [expandedPlans, setExpandedPlans] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadPlans = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await actionsScheduledPlansAdmin({
          query: {
            rangeStart: new Date(Date.now()).toISOString(),
            rangeEnd: new Date(
              Date.now() + 1000 * 60 * 60 * 24 * 7,
            ).toISOString(),
          },
        });

        if (!cancelled) {
          setPlans(response.data ?? null);
        }
      } catch (err) {
        console.error("Failed to load scheduled plans", err);
        if (!cancelled) {
          setError("Unable to load scheduled plans.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadPlans();

    return () => {
      cancelled = true;
    };
  }, []);

  const timelineItems = useMemo(() => {
    const suspensionItems = (plans?.suspensionPlans ?? []).map(
      (plan, index) => ({
        kind: "suspension" as const,
        key: `suspension-${plan.date}-${index}`,
        date: plan.date,
        users: plan.users ?? [],
      }),
    );

    const forumItems = (plans?.forumAutocompletePlans ?? []).map(
      (plan, index) => ({
        kind: "forum" as const,
        key: `forum-${plan.date}-${plan.action.id}-${index}`,
        date: plan.date,
        users: plan.users ?? [],
        action: plan.action,
      }),
    );

    return [...suspensionItems, ...forumItems].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
  }, [plans]);

  const togglePlan = (key: string) => {
    setExpandedPlans((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const formatPlanDate = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return { dayLabel: value, timeLabel: "" };
    }

    const dayLabel = new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      timeZone: "America/Los_Angeles",
    }).format(parsed);

    const timeLabel = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/Los_Angeles",
    }).format(parsed);

    return { dayLabel, timeLabel };
  };

  return (
    <CenterLayout width="3xl">
      <div className="mb-6 flex flex-col gap-1 min-w-3xl">
        <h1 className="font-semibold text-lg">Scheduled plans</h1>
        <p className="text-gray-600">Timeline of future automated actions</p>
      </div>

      <Card className="relative gap-4">
        {isLoading && (
          <div className="flex flex-row items-center justify-center gap-2">
            <Spinner size="small" />
            <p className="text-gray-500">Loading scheduled plans...</p>
          </div>
        )}

        {!isLoading && error && <p className="text-red-600">{error}</p>}

        {!isLoading && !error && timelineItems.length === 0 && (
          <p className="text-gray-500">
            No planned automated actions in this window.
          </p>
        )}

        {!isLoading && !error && timelineItems.length > 0 && (
          <div className="relative">
            <ul className="space-y-6">
              {timelineItems.map((item) => {
                const { dayLabel } = formatPlanDate(item.date);
                const utcLabel = new Date(item.date).toISOString();
                const isExpanded = expandedPlans.has(item.key);
                const userCount = item.users?.length ?? 0;

                return (
                  <li key={item.key} className="relative">
                    <div className="flex flex-col gap-3">
                      <button
                        type="button"
                        className="flex items-center justify-between gap-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-left transition hover:border-zinc-300"
                        aria-expanded={isExpanded}
                        onClick={() => togglePlan(item.key)}
                      >
                        <div className="flex flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-700">
                            <span className="font-semibold">{dayLabel}</span>
                            <span className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-xs font-medium text-gray-600">
                              {item.kind === "suspension"
                                ? "Suspension"
                                : "Forum action auto-complete"}
                            </span>
                          </div>
                          {item.kind === "forum" && (
                            <div className="text-sm text-gray-600">
                              Auto-complete for{" "}
                              <Link
                                to={`/actions/${item.action.id}`}
                                className="font-medium text-gray-900 hover:underline"
                              >
                                {item.action.name}
                              </Link>
                            </div>
                          )}
                          <div className="text-xs text-gray-400 font-mono">
                            {utcLabel}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Users size={16} className="text-gray-500" />
                            <span>
                              {withCount(userCount, "user")} scheduled
                            </span>
                          </div>
                        </div>
                        <ChevronDown
                          size={18}
                          className={cn(
                            "text-gray-500 transition-transform duration-150",
                            isExpanded && "-rotate-180",
                          )}
                        />
                      </button>

                      {isExpanded && (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {item.users?.map((user) => (
                            <Link
                              key={user.id}
                              className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-2 hover:bg-zinc-100"
                              to={`/member/${user.id}`}
                            >
                              <AvatarProfile
                                pfp={user.profilePicture ?? null}
                                size="medium"
                              />
                              <div className="min-w-0">
                                <p className="font-medium text-gray-900">
                                  {user.displayName}
                                </p>
                              </div>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </Card>
    </CenterLayout>
  );
};

export default ScheduledPlansPage;
