import {
  actionsSuspendPlans,
  SuspensionPlanDto,
} from "@alliance/shared/client";
import CenterLayout from "@alliance/shared/ui/CenterLayout";
import Card from "@alliance/shared/ui/Card";
import ProfileImage from "@alliance/shared/ui/ProfileImage";
import { ChevronDown, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

const ScheduledPlansPage = () => {
  const [suspensionPlans, setSuspensionPlans] = useState<SuspensionPlanDto[]>(
    []
  );
  const [expandedPlans, setExpandedPlans] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadPlans = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await actionsSuspendPlans({
          query: {
            rangeStart: new Date(Date.now()).toISOString(),
            rangeEnd: new Date(
              Date.now() + 1000 * 60 * 60 * 24 * 7
            ).toISOString(),
          },
        });

        if (!cancelled) {
          setSuspensionPlans(response.data ?? []);
        }
      } catch (err) {
        console.error("Failed to load suspension plans", err);
        if (!cancelled) {
          setError("Unable to load scheduled suspension plans.");
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

  const sortedPlans = useMemo(
    () =>
      [...suspensionPlans].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      ),
    [suspensionPlans]
  );

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
    }).format(parsed);

    const timeLabel = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }).format(parsed);

    return { dayLabel, timeLabel };
  };

  return (
    <CenterLayout width="3xl">
      <div className="mb-6 flex flex-col gap-1 min-w-3xl">
        <h1 className="font-semibold text-lg">Suspension plans</h1>
        <p className="text-gray-600">Timeline of future automated actions</p>
      </div>

      <Card className="relative gap-4">
        {isLoading && (
          <p className="text-gray-500">Loading suspension plans...</p>
        )}

        {!isLoading && error && <p className="text-red-600">{error}</p>}

        {!isLoading && !error && sortedPlans.length === 0 && (
          <p className="text-gray-500">
            No planned suspensions in this window.
          </p>
        )}

        {!isLoading && !error && sortedPlans.length > 0 && (
          <div className="relative">
            <ul className="space-y-6">
              {sortedPlans.map((plan, index) => {
                const key = `${plan.date}-${index}`;
                const { dayLabel } = formatPlanDate(plan.date);
                const isExpanded = expandedPlans.has(key);
                const userCount = plan.users?.length ?? 0;

                return (
                  <li key={key} className="relative">
                    <div className="flex flex-col gap-3">
                      <button
                        type="button"
                        className="flex items-center justify-between gap-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-left transition hover:border-zinc-300"
                        aria-expanded={isExpanded}
                        onClick={() => togglePlan(key)}
                      >
                        <div className="flex flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-700">
                            <span className="font-semibold">{dayLabel}</span>
                            {/* {timeLabel && (
                              <span className="text-gray-500">
                                by {timeLabel}
                              </span>
                            )} */}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Users size={16} className="text-gray-500" />
                            <span>
                              {userCount} {userCount === 1 ? "user" : "users"}{" "}
                              scheduled
                            </span>
                          </div>
                        </div>
                        <ChevronDown
                          size={18}
                          className={`text-gray-500 transition-transform duration-150 ${
                            isExpanded ? "-rotate-180" : ""
                          }`}
                        />
                      </button>

                      {isExpanded && (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {plan.users?.map((user) => (
                            <Link
                              key={user.id}
                              className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-2 hover:bg-zinc-100"
                              to={`/member/${user.id}`}
                            >
                              <ProfileImage
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
