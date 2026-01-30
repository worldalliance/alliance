import CheckIcon from "@alliance/sharedweb/ui/icons/CheckIcon";
import { useMemo, useState } from "react";
import { Link, href, useNavigate, useOutletContext } from "react-router";
import { AppLayoutOutletContext } from "../../applayout";
import BasicErrorMessage from "../../components/BasicErrorMessage";
import GlobalFeed from "../../components/GlobalFeed";
import { useWhiteBackground } from "../../components/HtmlBackgroundManager";
import Spinner from "@alliance/sharedweb/ui/Spinner";
import TwoColumnLayout from "../../components/TwoColumnLayout";
import { useAuth } from "../../lib/AuthContext";
import { useCIDFromParams } from "../../lib/utils";
import LargeActionCard, { LargeActionCardProps } from "./LargeActionCard";
import useGlobalFeed from "@alliance/shared/lib/useGlobalFeed";
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
  showActionInSidebarList,
  deadlineHasPassed,
  TaskAwayStatus,
} from "@alliance/shared/lib/actionUtils";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { ChevronDown, ChevronUp } from "lucide-react";

const HomePage = () => {
  const navigate = useNavigate();
  const { actions, loading, handleDismissAction } =
    useOutletContext<AppLayoutOutletContext>();

  const { user } = useAuth();

  const [showingTasksList, setShowingTasksList] = useState(false);

  const { items: globalFeedItems, loading: globalFeedLoading } = useGlobalFeed({
    limit: 10,
  });

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

  const numTodo = todoActions.filter(showActionInSidebarList).length;

  const isLargeScreen = useMediaQuery("(min-width: 1150px)");

  const tasksListContent = useMemo(() => {
    const currentWeekSidebarActions = currentWeekTodoActions.filter(
      showActionInSidebarList
    );

    return (
      <>
        {(currentWeekSidebarActions.length > 0 ||
          completedActions.length > 0) && (
            <div className="flex flex-col gap-y-2">
              <p className="font-semibold text-base font-serif text-black">
                Progress
              </p>
              {currentWeekSidebarActions.length + newActions.length > 0 && (
                <p className="text-zinc-600 mb-2">
                  <span className="text-green font-medium mr-0.5">
                    {currentWeekSidebarActions.length} task
                    {currentWeekSidebarActions.length !== 1 ? "s" : ""} left{" "}
                  </span>
                  {numTodo > 0 &&
                    remainingTasksEstimatedTimeCurrentWeek > 0 &&
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
                      {action.optional && "(Optional) "}
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
                      {action.optional && "(Optional) "}
                      {action.name}
                    </Link>
                  </div>
                ))}
                {nextWeekTodoActions.length > 0 && (
                  <>
                    <p className="text-zinc-500 mt-3 font-medium">Upcoming</p>
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

      </>);
  }, [completedActions, currentWeekTodoActions, newActions, nextWeekTodoActions, numTodo, remainingTasksEstimatedTimeCurrentWeek]);

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
        }
        : deadlineHasPassed(currentTask, new Date())
          ? {
            message: TASK_DISMISS_MESSAGE_AFTER_DEADLINE,
          }
          : undefined;


    return (
      <div
        className={
          "flex flex-col py-4 sm:py-8 md:py-18 px-4 max-w-3xl mx-auto min-h-full relative"
        }
      >
        {!isLargeScreen && (
          <div className="pb-4">
            <Button
              onClick={() => setShowingTasksList(!showingTasksList)}
              color={ButtonColor.Transparent}
              className="hover:bg-transparent"
            >
              All tasks {showingTasksList ? <ChevronUp size="15" /> : <ChevronDown size="15" />}
            </Button>
            {showingTasksList && <div className="px-2 sm:px-4 flex flex-col *:py-4 *:px-2 divide-y divide-zinc-200 border border-zinc-200 rounded">{tasksListContent}</div>}
          </div>)}
        {currentTask && currentTask.userRelation ? (
          <LargeActionCard
            action={currentTask}
            dismissProps={dismissProps}
            handleDismiss={() => handleDismissAction(currentTask.id)}
            userRelation={currentTask.userRelation as "joined" | "none"}
            onUpdateActionState={() => navigate(href("/tasks"))}
          />
        ) : (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-y-4">
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
  }, [actions, loading, currentTask, user, navigate, handleDismissAction, showingTasksList, tasksListContent, isLargeScreen]);

  const sidebarContent = useMemo(() => {
    return (
      <div className="px-4 pt-12 flex flex-col *:py-6 *:px-2 divide-y divide-zinc-200 h-full">
        {tasksListContent}
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex flex-row justify-between items-center shrink-0">
            <p className="font-semibold text-base font-serif text-black">
              Activity
            </p>
            <Link
              to={href("/feed")}
              className="text-zinc-500 text-base hover:underline"
            >
              See all
            </Link>
          </div>
          <GlobalFeed items={globalFeedItems} loading={globalFeedLoading} fitToHeight />
        </div>
      </div>
    );
  }, [
    tasksListContent,
    globalFeedItems,
    globalFeedLoading,
  ]);

  useWhiteBackground();

  return isLargeScreen ? (
    <TwoColumnLayout main={mainContent} sidebar={sidebarContent} noSidebarOverflow />
  ) : (
    <div className="h-full">{mainContent}</div>
  );
};

export default HomePage;
