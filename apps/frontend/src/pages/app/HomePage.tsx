import CheckIcon from "@alliance/shared/ui/icons/CheckIcon";
import { Link, href, useNavigate, useOutletContext } from "react-router";
import { ActionWithRelation, AppLayoutOutletContext } from "../../applayout";
import ActionActivityFeedItem from "../../components/ActionActivityFeedItem";
import { useWhiteBackground } from "../../components/HtmlBackgroundManager";
import LargeActionCard from "./LargeActionCard";
import useActivities, { ActivityList } from "./useActivities";
import BasicErrorMessage from "../../components/BasicErrorMessage";
import { useAuth } from "../../lib/AuthContext";
import Spinner from "../../components/Spinner";
import { getPastEvents } from "@alliance/shared/lib/actionUtils";
import { useCIDFromParams } from "../../lib/utils";
import TwoColumnLayout from "../../components/TwoColumnLayout";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export function canCompleteAction(action: ActionWithRelation) {
  return (
    getPastEvents(action).some(
      (event) => event.newStatus === "member_action"
    ) &&
    (action.relation === "joined" ||
      (action.commitmentless && action.relation !== "completed")) &&
    action.relation !== "declined" &&
    action.canParticipate
  );
}

export function shouldCompleteAction(action: ActionWithRelation) {
  return (
    canCompleteAction(action) &&
    action.shouldParticipate &&
    (action.status === "member_action" ||
      action.status === "gathering_commitments")
  );
}

export function isCurrentlyCompletedAction(action: ActionWithRelation) {
  return (
    action.shouldParticipate &&
    (action.status === "member_action" ||
      action.status === "gathering_commitments") &&
    !action.everyoneShouldComplete &&
    action.relation === "completed"
  );
}

export function canJoinAction(action: ActionWithRelation) {
  return (
    action.status === "gathering_commitments" &&
    action.relation === "none" &&
    action.canParticipate
  );
}

function getDeadlineTimestamp(action: ActionWithRelation): number {
  let i = 0;
  // Find first 'member_action' or 'gathering_commitments' event
  while (
    action.events[i] &&
    action.events[i].newStatus !== "member_action" &&
    action.events[i].newStatus !== "gathering_commitments"
  ) {
    i++;
  }

  // Find next non-'member_action' or 'gathering_commitments' event
  while (
    action.events[i] &&
    (action.events[i].newStatus === "member_action" ||
      action.events[i].newStatus === "gathering_commitments")
  ) {
    i++;
  }

  const nextEvent = action.events[i];
  if (!nextEvent) {
    return Infinity;
  }

  return new Date(nextEvent.date).getTime();
}

function actionPriorityComparator(
  actionA: ActionWithRelation,
  actionB: ActionWithRelation
): number {
  // Sort by priority
  if (actionA.priority !== actionB.priority) {
    return actionB.priority - actionA.priority;
  }

  // Sort by earliest deadline first
  const deadlineA = getDeadlineTimestamp(actionA);
  const deadlineB = getDeadlineTimestamp(actionB);
  if (deadlineA !== Infinity || deadlineB !== Infinity) {
    return deadlineA - deadlineB;
  }

  // Both do not have deadlines: sort by earliest member action
  const memberActionA = actionA.events.find(
    (event) =>
      event.newStatus === "member_action" ||
      event.newStatus === "gathering_commitments"
  );
  if (!memberActionA) {
    return 1;
  }
  const memberActionB = actionB.events.find(
    (event) =>
      event.newStatus === "member_action" ||
      event.newStatus === "gathering_commitments"
  );
  if (!memberActionB) {
    return -1;
  }
  return (
    new Date(memberActionA.date).getTime() -
    new Date(memberActionB.date).getTime()
  );
}

const HomePage = () => {
  const navigate = useNavigate();
  const { actions, loading } = useOutletContext<AppLayoutOutletContext>();

  const { activities: friendActivities, handleLikeActivity } = useActivities({
    list: ActivityList.Friends,
    limit: 8,
  });
  const [visibleFriendActivityCount, setVisibleFriendActivityCount] =
    useState<number>(3);
  const friendActivityListRef = useRef<HTMLDivElement | null>(null);
  const firstFriendActivityRef = useRef<HTMLDivElement | null>(null);

  useCIDFromParams();

  const { user } = useAuth();

  const todoActions = useMemo(() => {
    return (
      actions
        ?.filter((action) => shouldCompleteAction(action))
        .sort(actionPriorityComparator) || []
    );
  }, [actions]);

  const newActions =
    actions
      ?.filter((action) => canJoinAction(action))
      .sort((a, b) => {
        return b.priority - a.priority;
      }) || [];

  const isActionDeadlineWithinDays = useCallback(
    (action: ActionWithRelation, days: number) => {
      const deadlineEvent = action.events.find(
        (event) => event.newStatus === "office_action"
      );
      if (!deadlineEvent) {
        return true;
      }
      return (
        new Date(deadlineEvent.date) <
        new Date(new Date().setDate(new Date().getDate() + days))
      );
    },
    []
  );

  const doesCurrentWeekHaveActions = useMemo(
    () =>
      todoActions.some((action) => {
        return isActionDeadlineWithinDays(action, 7);
      }),
    [todoActions, isActionDeadlineWithinDays]
  );

  const isActionInCurrentWeek = useCallback(
    (action: ActionWithRelation) => {
      if (doesCurrentWeekHaveActions) {
        return isActionDeadlineWithinDays(action, 7);
      } else {
        return isActionDeadlineWithinDays(action, 14);
      }
    },
    [doesCurrentWeekHaveActions, isActionDeadlineWithinDays]
  );

  const currentTask: ActionWithRelation | null =
    newActions[0] || todoActions[0] || null;
  const currentWeekTodoActions = todoActions.filter((action) => {
    return isActionInCurrentWeek(action);
  });
  const nextWeekTodoActions = todoActions.filter((action) => {
    return !isActionInCurrentWeek(action);
  });

  const remainingTasksEstimatedTimeCurrentWeek = currentWeekTodoActions.reduce(
    (sum, action) => {
      if (action.timeEstimate) {
        return sum + action.timeEstimate;
      }
      return sum;
    },
    0
  );

  const completedActions =
    actions?.filter((action) => isCurrentlyCompletedAction(action)) || [];

  const updateFriendActivityCount = useCallback(() => {
    if (typeof window === "undefined" || !friendActivityListRef.current) {
      return;
    }

    if (friendActivities.length === 0) {
      setVisibleFriendActivityCount(0);
      return;
    }

    const availableHeight =
      window.innerHeight -
      friendActivityListRef.current.getBoundingClientRect().top -
      12;
    const firstActivityHeight =
      firstFriendActivityRef.current?.getBoundingClientRect().height;

    if (!firstActivityHeight || availableHeight <= 0) {
      setVisibleFriendActivityCount(1);
      return;
    }

    const maxItems = Math.max(
      1,
      Math.floor(availableHeight / firstActivityHeight)
    );

    setVisibleFriendActivityCount(Math.min(maxItems, friendActivities.length));
  }, [friendActivities.length]);

  useEffect(() => {
    updateFriendActivityCount();
  }, [
    updateFriendActivityCount,
    completedActions.length,
    currentWeekTodoActions.length,
    newActions.length,
    nextWeekTodoActions.length,
  ]);

  useEffect(() => {
    window.addEventListener("resize", updateFriendActivityCount);
    return () => {
      window.removeEventListener("resize", updateFriendActivityCount);
    };
  }, [updateFriendActivityCount]);

  const mainContent = () => {
    if (actions === null) {
      return loading ? (
        <div className="flex justify-center items-center h-screen">
          <Spinner size="large" />
        </div>
      ) : (
        <BasicErrorMessage>Error loading actions</BasicErrorMessage>
      );
    }

    return (
      <div
        className={
          "flex flex-col py-8 sm:py-18 px-4 max-w-3xl mx-auto min-h-full justify-center"
        }
      >
        {currentTask && currentTask.relation ? (
          <LargeActionCard
            action={currentTask}
            userRelation={currentTask.relation as "joined" | "none"}
            friendActivities={friendActivities.filter(
              (activity) => activity.actionId === currentTask.id
            )}
            onUpdateActionState={() => navigate(href("/tasks"))}
          />
        ) : (
          <div className="mt-4 px-2 py-2 mx-auto flex flex-col items-center gap-y-4 h-full justify-center">
            {user && !user.hasActiveContract ? (
              <p className="text-center text-zinc-500">
                You will not be given new tasks while your contract is
                suspended.
              </p>
            ) : (
              <>
                <CheckIcon size="large" />
                <p className="text-center text-zinc-500 text-lg lg:text-xl">
                  No tasks to do right now
                </p>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  const sidebarContent = () => {
    return (
      <div className="px-4 pt-12 flex flex-col divide-y *:py-6 *:px-2 divide-zinc-200">
        {todoActions.length + newActions.length > 0 && (
          <div className="flex flex-col gap-y-2">
            <p className="font-semibold text-base font-serif text-black">
              Progress
            </p>
            {currentWeekTodoActions.length + newActions.length > 0 && (
              <p className="text-zinc-600 mb-2">
                <span className="text-green font-medium mr-0.5">
                  {currentWeekTodoActions.length} task
                  {currentWeekTodoActions.length !== 1 ? "s" : ""} left{" "}
                </span>
                {todoActions.length > 0 &&
                  `for a total of ${remainingTasksEstimatedTimeCurrentWeek} minutes`}
              </p>
            )}
            <ul className="space-y-2 list-disc">
              {completedActions.map((action) => (
                <div key={action.id} className="text-zinc-600 flex gap-x-2">
                  <CheckIcon size="line" />
                  <Link
                    to={href("/actions/:id", { id: action.id.toString() })}
                    className="text-zinc-400 line-through"
                  >
                    {action.name}
                  </Link>
                </div>
              ))}
              {currentWeekTodoActions.map((action) => (
                <div key={action.id} className="text-zinc-600 flex gap-x-2">
                  <div className="!w-4 !h-4 shrink-0 border-2 border-zinc-200 rounded-full mt-[4px]"></div>
                  <Link
                    to={href("/actions/:id", { id: action.id.toString() })}
                    className="text-zinc-600"
                  >
                    {action.name}
                  </Link>
                </div>
              ))}
              {nextWeekTodoActions.length > 0 && (
                <>
                  <p className="text-zinc-500 mt-3 font-medium">Next week</p>
                  {nextWeekTodoActions.map((action) => (
                    <div key={action.id} className="text-zinc-600 flex gap-x-2">
                      <div className="!w-4 !h-4 shrink-0 border-2 border-zinc-200 rounded-full mt-[4px]"></div>
                      <Link
                        to={href("/actions/:id", { id: action.id.toString() })}
                        className="text-zinc-600"
                      >
                        {action.name}
                      </Link>
                    </div>
                  ))}
                </>
              )}
            </ul>
          </div>
        )}

        <div className="">
          <div className="flex flex-row justify-between items-center mb-3">
            <p className="font-semibold text-base font-serif text-black">
              Friend activity
            </p>
            {friendActivities.length > 0 && (
              <Link
                to={href("/feed")}
                className="text-zinc-800 font-medium hover:underline mt-0"
              >
                See all
              </Link>
            )}
          </div>
          <div
            className="flex flex-col *:py-3 -my-3"
            ref={friendActivityListRef}
          >
            {friendActivities.length === 0 && (
              <div className="space-x-1">
                <span className="text-zinc-400 mb-3">No activity yet.</span>
                <a href="/members" className="text-link">
                  Find friends
                </a>
              </div>
            )}
            {friendActivities
              .slice(
                0,
                friendActivities.length === 0
                  ? 0
                  : Math.max(visibleFriendActivityCount, 1)
              )
              .map((activity, index) => (
                <div
                  key={activity.id}
                  ref={index === 0 ? firstFriendActivityRef : undefined}
                >
                  <ActionActivityFeedItem
                    activity={activity}
                    showTime={false}
                    card={false}
                    showAction={true}
                    handleLike={() => handleLikeActivity(activity.id)}
                  />
                </div>
              ))}
          </div>
        </div>
      </div>
    );
  };

  useWhiteBackground();

  return (
    <>
      <div className="hidden lg:block">
        <TwoColumnLayout main={mainContent()} sidebar={sidebarContent()} />
      </div>

      <div className="lg:hidden">{mainContent()}</div>
    </>
  );
};

export default HomePage;
