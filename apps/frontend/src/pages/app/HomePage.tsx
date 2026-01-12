import CheckIcon from "@alliance/sharedweb/ui/icons/CheckIcon";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, href, useNavigate, useOutletContext } from "react-router";
import { AppLayoutOutletContext } from "../../applayout";
import ActionActivityFeedItem from "../../components/ActionActivityFeedItem";
import BasicErrorMessage from "../../components/BasicErrorMessage";
import { useWhiteBackground } from "../../components/HtmlBackgroundManager";
import Spinner from "@alliance/sharedweb/ui/Spinner";
import TwoColumnLayout from "../../components/TwoColumnLayout";
import { useAuth } from "../../lib/AuthContext";
import { useCIDFromParams } from "../../lib/utils";
import LargeActionCard, { LargeActionCardProps } from "./LargeActionCard";
import useActivities, {
  ActivityList,
} from "@alliance/shared/lib/useActivities";
import { useMediaQuery } from "../../lib/useMediaQuery";
import { useHomePageActions } from "@alliance/shared/lib/homePage";
import {
  noTasksContractSuspended,
  noTasksToDoRightNow,
  TASK_DISMISS_MESSAGE_CURRENTLY_AWAY,
  TASK_DISMISS_MESSAGE_AFTER_DEADLINE,
  TASK_DISMISS_MESSAGE_WAS_AWAY,
  TASK_DISMISS_MESSAGE_WILL_BE_AWAY,
} from "@alliance/shared/lib/copy";
import {
  todoActionIsMandatory,
  deadlineHasPassed,
  TaskAwayStatus,
} from "@alliance/shared/lib/actionUtils";
import ProfileImage from "@alliance/sharedweb/ui/ProfileImage";
import { formatTime } from "@alliance/shared/lib/utils";

const HomePage = () => {
  const navigate = useNavigate();
  const { posts, actions, loading, handleDismissAction } =
    useOutletContext<AppLayoutOutletContext>();

  const { user } = useAuth();

  const { activities: friendActivities, handleLikeActivity } = useActivities({
    list: ActivityList.Friends,
    limit: 8,
  });

  const [visibleFriendActivityCount, setVisibleFriendActivityCount] =
    useState<number>(3);
  const friendActivityListRef = useRef<HTMLDivElement | null>(null);
  const firstFriendActivityRef = useRef<HTMLDivElement | null>(null);

  useCIDFromParams();

  const {
    currentTask,
    todoActions,
    newActions,
    currentWeekTodoActions,
    nextWeekTodoActions,
    remainingTasksEstimatedTimeCurrentWeek,
    completedActions,
  } = useHomePageActions(actions);

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

    const maxItems = Math.min(
      5,
      Math.max(1, Math.floor(availableHeight / firstActivityHeight))
    );

    setVisibleFriendActivityCount(Math.min(maxItems, friendActivities.length));
  }, [friendActivities.length]);

  useLayoutEffect(() => {
    updateFriendActivityCount();
  }, [updateFriendActivityCount]);

  const mainContent = useMemo(() => {
    if (actions === null) {
      return loading ? (
        <div className="flex justify-center items-center h-screen">
          <Spinner size="large" />
        </div>
      ) : (
        <BasicErrorMessage>Error loading actions</BasicErrorMessage>
      );
    }

    const dismissProps: LargeActionCardProps["dismissProps"] = !currentTask
      ? undefined
      : currentTask.awayStatus !== TaskAwayStatus.NOT_AWAY
      ? {
          message: {
            [TaskAwayStatus.AWAY_CURRENTLY]:
              TASK_DISMISS_MESSAGE_CURRENTLY_AWAY,
            [TaskAwayStatus.AWAY_LATER]: TASK_DISMISS_MESSAGE_WILL_BE_AWAY,
            [TaskAwayStatus.AWAY_PREVIOUSLY]: TASK_DISMISS_MESSAGE_WAS_AWAY,
          }[currentTask?.awayStatus],
          handleDismiss: () => handleDismissAction(currentTask.id),
        }
      : deadlineHasPassed(currentTask, new Date())
      ? {
          message: TASK_DISMISS_MESSAGE_AFTER_DEADLINE,
          handleDismiss: () => handleDismissAction(currentTask.id),
        }
      : undefined;

    return (
      <div
        className={
          "flex flex-col py-8 sm:py-18 px-4 max-w-3xl mx-auto min-h-full"
        }
      >
        {currentTask && currentTask.userRelation ? (
          <LargeActionCard
            action={currentTask}
            dismissProps={dismissProps}
            userRelation={currentTask.userRelation as "joined" | "none"}
            friendActivities={friendActivities.filter(
              (activity) => activity.actionId === currentTask.id
            )}
            onUpdateActionState={() => navigate(href("/tasks"))}
          />
        ) : (
          <div className="mt-4 px-2 py-2 mx-auto flex flex-col items-center gap-y-4 h-full justify-center">
            {user && !user.hasActiveContract ? (
              <p className="text-center text-zinc-500">
                {noTasksContractSuspended}
              </p>
            ) : (
              <>
                <CheckIcon size="large" />
                <p className="text-center text-zinc-500 text-lg lg:text-xl">
                  {noTasksToDoRightNow}
                </p>
              </>
            )}
          </div>
        )}
      </div>
    );
  }, [
    actions,
    loading,
    currentTask,
    user,
    friendActivities,
    navigate,
    handleDismissAction,
  ]);

  const numTodo = todoActions.filter(todoActionIsMandatory).length;
  const sidebarContent = useMemo(() => {
    const currentWeekMandatoryTodoActions = currentWeekTodoActions.filter(
      todoActionIsMandatory
    );

    return (
      <div className="px-4 pt-12 flex flex-col *:py-6 *:px-2 divide-y divide-zinc-200">
        {(currentWeekMandatoryTodoActions.length > 0 ||
          completedActions.length > 0) && (
          <div className="flex flex-col gap-y-2">
            <p className="font-semibold text-base font-serif text-black">
              Progress
            </p>
            {currentWeekMandatoryTodoActions.length + newActions.length > 0 && (
              <p className="text-zinc-600 mb-2">
                <span className="text-green font-medium mr-0.5">
                  {currentWeekMandatoryTodoActions.length} task
                  {currentWeekMandatoryTodoActions.length !== 1
                    ? "s"
                    : ""} left{" "}
                </span>
                {numTodo > 0 &&
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

        <div>
          <div className="flex flex-row justify-between items-center mb-3">
            <p className="font-semibold text-base font-serif text-black">
              Forum activity
            </p>
          </div>
          {posts &&
            posts.slice(0, 1).map((post) => {
              return (
                <Link
                  to={href("/forum/post/:id", { id: post.id.toString() })}
                  key={post.id}
                  className="flex flex-row gap-x-2 items-center flex-1 hover:bg-zinc-50 hover:p-2 hover:-m-2 rounded"
                >
                  <ProfileImage
                    pfp={post.author.profilePicture}
                    size="medium"
                    className="self-start mt-1.5"
                  />
                  <div className="flex-1 text-zinc-700">
                    <p className="font-medium">{post.author.displayName}</p>

                    <p className="">
                      <span className="text-zinc-500 text-nowrap">posted </span>
                      <span className="text-green">{post.title}</span>
                      <span className="text-zinc-500 text-nowrap">
                        {" "}
                        {formatTime(new Date(post.createdAt), {
                          addSuffix: true,
                        })}
                      </span>
                    </p>
                  </div>
                </Link>
              );
            })}
        </div>

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
          <div className="flex flex-col gap-y-5" ref={friendActivityListRef}>
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
  }, [
    completedActions,
    currentWeekTodoActions,
    friendActivities,
    handleLikeActivity,
    newActions.length,
    nextWeekTodoActions,
    remainingTasksEstimatedTimeCurrentWeek,
    posts,
    numTodo,
    visibleFriendActivityCount,
  ]);

  useWhiteBackground();

  const isLargeScreen = useMediaQuery("(min-width: 1150px)");

  return isLargeScreen ? (
    <TwoColumnLayout main={mainContent} sidebar={sidebarContent} />
  ) : (
    <div className="h-full">{mainContent}</div>
  );
};

export default HomePage;
