import { MEMBER_ACTION_DEADLINE_PASSED } from "@alliance/common/actionActivity";
import {
  dismissActionErrorMessage,
  useInvalidateActions,
} from "@alliance/shared/lib/actionsListPage";
import {
  noTasksContractSuspended,
  noTasksToDoRightNow,
} from "@alliance/shared/lib/copy";
import { homeItemKey, useHomePageActions } from "@alliance/shared/lib/homePage";
import { getTaskDismissInfo } from "@alliance/shared/lib/largeActionCard";
import { useBoundedIndex } from "@alliance/shared/lib/useBoundedIndex";
import useGlobalFeed from "@alliance/shared/lib/useGlobalFeed";
import { resetHomeFeed } from "@alliance/shared/lib/useHomeFeed";
import { useMediaQuery } from "@alliance/sharedweb/lib/useMediaQuery";
import CheckIcon from "@alliance/sharedweb/ui/icons/CheckIcon";
import Spinner from "@alliance/sharedweb/ui/Spinner";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import FollowUpFormPanel from "../../components/FollowUpFormPanel";
import GlobalFeed from "../../components/GlobalFeed";
import HomeFeed from "../../components/HomeFeed";
import HomeGeneralUpdates from "../../components/HomeGeneralUpdates";
import { useWhiteBackground } from "../../components/HtmlBackgroundManager";
import LoadFailed from "../../components/LoadFailed";
import SidebarProgressBars from "../../components/SidebarProgressBars";
import TwoColumnLayout from "../../components/TwoColumnLayout";
import { useAuth } from "../../lib/AuthContext";
import { useSidebarProgressBarEntries } from "../../lib/useSidebarProgressBarEntries";
import { useTaskActionsData } from "../../lib/useTaskActionsData";
import { useSidFromParams } from "../../lib/utils";
import { MOCK_TASK_FORMS, MOCK_TASKS } from "../../onboarding/mockTasks";
import { useMockTasks } from "../../onboarding/useMockTasks";
import { WalkthroughAnchor } from "../../onboarding/walkthrough/steps";
import LargeActionCard from "./LargeActionCard";
import TaskNavigatorList, { type TaskNavigatorItem } from "./TaskNavigatorList";

const HomePage = () => {
  const queryClient = useQueryClient();
  const invalidateActions = useInvalidateActions();
  const { warning, error: toastError } = useToast();
  const {
    actions: liveActions,
    generalUpdates,
    generalUpdatesFailure,
    actionsFailure,
    handleDismissAction,
    handleDismissGeneralUpdate,
  } = useTaskActionsData();

  const mocked = useMockTasks();
  const actions = mocked ? MOCK_TASKS : liveActions;

  const { user, refreshUser } = useAuth();
  const hasRefreshedForNoContract = useRef(false);

  useEffect(() => {
    if (user && !user.hasActiveContract && !hasRefreshedForNoContract.current) {
      hasRefreshedForNoContract.current = true;
      refreshUser();
    }
  }, [user, refreshUser]);

  const mainScrollRef = useRef<HTMLDivElement | null>(null);

  const {
    items: globalFeedItems,
    loading: globalFeedLoading,
    failure: globalFeedFailure,
  } = useGlobalFeed({ limit: 10 });

  useSidFromParams();

  const {
    todoActions,
    currentWeekTodoActions,
    nextWeekTodoActions,
    remainingTasksEstimatedTimeCurrentWeek,
    completedActions,
    activeCompletableFollowUpForms,
  } = useHomePageActions(actions);

  const isLargeScreen = useMediaQuery("(min-width: 1150px)");

  const sidebarProgressBarEntries = useSidebarProgressBarEntries(actions);

  const taskNavigatorItems = useMemo<TaskNavigatorItem[]>(() => {
    const actionCards: TaskNavigatorItem[] = todoActions.map(
      (action) => ({ kind: "action", action }) as const,
    );

    // Follow-up forms come after the todo actions; order within follow-ups is
    // already handled by `activeCompletableFollowUpForms`.
    const followUpCards: TaskNavigatorItem[] =
      activeCompletableFollowUpForms.map(({ followUpForm, actionId }) => ({
        kind: "followUpForm" as const,
        followUpForm,
        actionId,
      }));

    return [...actionCards, ...followUpCards];
  }, [todoActions, activeCompletableFollowUpForms]);

  const taskNavigatorKeys = useMemo(
    () => taskNavigatorItems.map(homeItemKey),
    [taskNavigatorItems],
  );
  const { index: taskNavigatorIndex, setIndex: setTaskNavigatorIndex } =
    useBoundedIndex(taskNavigatorKeys);

  const selectedTaskNavigatorItem =
    taskNavigatorItems.length === 0
      ? undefined
      : taskNavigatorItems[taskNavigatorIndex];

  const mainContent = useMemo(() => {
    if (actions === null) {
      return actionsFailure ? (
        <LoadFailed message="Couldn't load your tasks." {...actionsFailure} />
      ) : (
        <div className="flex justify-center items-center h-screen">
          <Spinner size="large" />
        </div>
      );
    }

    const taskDismissInfo =
      selectedTaskNavigatorItem?.kind === "action"
        ? getTaskDismissInfo(selectedTaskNavigatorItem.action)
        : undefined;

    return (
      <div
        className={
          "flex flex-col gap-y-8 sm:gap-y-12 lg:gap-y-16 py-4 sm:py-8 px-4 xl:px-0 max-w-3xl mx-auto relative"
        }
      >
        <div className="flex flex-col gap-4">
          {isLargeScreen && (
            <HomeGeneralUpdates
              generalUpdates={generalUpdates}
              failure={generalUpdatesFailure}
              onDismiss={handleDismissGeneralUpdate}
            />
          )}

          {!isLargeScreen && (
            <div>
              <SidebarProgressBars entries={sidebarProgressBarEntries} />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4 flex-1">
          <p className="text-title">Tasks</p>
          <TaskNavigatorList
            actions={actions}
            completedActions={completedActions}
            currentWeekTodoActions={currentWeekTodoActions}
            nextWeekTodoActions={nextWeekTodoActions}
            remainingTasksEstimatedTimeCurrentWeek={
              remainingTasksEstimatedTimeCurrentWeek
            }
            activeCompletableFollowUpForms={activeCompletableFollowUpForms}
            items={taskNavigatorItems}
            selectedItem={selectedTaskNavigatorItem}
            onSelectIndex={setTaskNavigatorIndex}
          />

          {selectedTaskNavigatorItem?.kind === "action" ? (
            <div data-walkthrough={WalkthroughAnchor.CurrentTask}>
              <LargeActionCard
                action={selectedTaskNavigatorItem.action}
                staticTaskFormSchema={
                  mocked
                    ? MOCK_TASK_FORMS[selectedTaskNavigatorItem.action.id]
                    : undefined
                }
                dismissProps={
                  taskDismissInfo
                    ? {
                        ...taskDismissInfo,
                        onDismiss: () =>
                          handleDismissAction(
                            selectedTaskNavigatorItem.action.id,
                          ).catch((caught: unknown) =>
                            toastError(dismissActionErrorMessage(caught)),
                          ),
                      }
                    : undefined
                }
                userRelation={
                  selectedTaskNavigatorItem.action.userRelation ?? "none"
                }
                onCompleteAction={() => {
                  resetHomeFeed(queryClient);
                }}
                onUpdateActionState={() => {
                  invalidateActions();
                  mainScrollRef.current?.scrollTo({
                    top: 0,
                    behavior: "instant",
                  });
                  document.scrollingElement?.scrollTo({
                    top: 0,
                    behavior: "instant",
                  });
                  window.scrollTo({ top: 0, behavior: "instant" });
                }}
                onDeadlinePassed={() => {
                  warning(
                    MEMBER_ACTION_DEADLINE_PASSED,
                    selectedTaskNavigatorItem.action.name,
                  );
                  invalidateActions();
                }}
                scrollContainerRef={mainScrollRef}
              />
            </div>
          ) : selectedTaskNavigatorItem?.kind === "followUpForm" ? (
            <div className="w-full mx-auto">
              <FollowUpFormPanel
                key={selectedTaskNavigatorItem.followUpForm.id}
                followUpForm={selectedTaskNavigatorItem.followUpForm}
                actionId={selectedTaskNavigatorItem.actionId}
              />
            </div>
          ) : (
            <div className="w-full flex flex-col items-center">
              {user && !user.hasActiveContract ? (
                <p className="text-center text-zinc-500">
                  {noTasksContractSuspended}
                </p>
              ) : (
                <>
                  <div className="flex flex-col items-center w-full flex-8 gap-y-4">
                    {activeCompletableFollowUpForms.length > 0 ? (
                      <div className="flex flex-col gap-y-4 w-full max-w-2xl">
                        {activeCompletableFollowUpForms.map(
                          ({ followUpForm, actionId }) => (
                            <FollowUpFormPanel
                              key={followUpForm.id}
                              followUpForm={followUpForm}
                              actionId={actionId}
                            />
                          ),
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-y-4 rounded border border-grey-2 w-full py-8 lg:py-12 px-8">
                        <CheckIcon size={32} />
                        <p className="text-center text-zinc-500 text-lg lg:text-xl">
                          {noTasksToDoRightNow}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {!isLargeScreen && (
          <div className="flex flex-col gap-4">
            <HomeGeneralUpdates
              generalUpdates={generalUpdates}
              failure={generalUpdatesFailure}
              onDismiss={handleDismissGeneralUpdate}
            />
          </div>
        )}

        <HomeFeed />
      </div>
    );
  }, [
    actions,
    selectedTaskNavigatorItem,
    user,
    handleDismissAction,
    handleDismissGeneralUpdate,
    generalUpdates,
    generalUpdatesFailure,
    actionsFailure,
    completedActions,
    currentWeekTodoActions,
    nextWeekTodoActions,
    remainingTasksEstimatedTimeCurrentWeek,
    taskNavigatorItems,
    setTaskNavigatorIndex,
    queryClient,
    invalidateActions,
    warning,
    toastError,
    activeCompletableFollowUpForms,
    isLargeScreen,
    mocked,
    sidebarProgressBarEntries,
  ]);

  const sidebarContent = useMemo(() => {
    return (
      <div className="pt-6 px-4 flex flex-col *:pb-4 *:px-2 h-[calc(100vh-var(--navbar-top-bar-height))]">
        <SidebarProgressBars entries={sidebarProgressBarEntries} />
        <div className="flex-1 min-h-0 flex flex-col">
          <GlobalFeed
            items={globalFeedItems}
            loading={globalFeedLoading}
            failure={globalFeedFailure}
            fitToHeight
          />
        </div>
      </div>
    );
  }, [
    globalFeedItems,
    globalFeedLoading,
    globalFeedFailure,
    sidebarProgressBarEntries,
  ]);

  useWhiteBackground();

  return isLargeScreen ? (
    <TwoColumnLayout
      main={mainContent}
      sidebar={sidebarContent}
      noSidebarOverflow
      mainScrollRef={mainScrollRef}
    />
  ) : (
    <div
      ref={mainScrollRef}
      className="w-full h-[calc(100vh-var(--navbar-top-bar-height))] bg-page overflow-y-auto [scrollbar-gutter:stable]"
    >
      {mainContent}
    </div>
  );
};

export default HomePage;
