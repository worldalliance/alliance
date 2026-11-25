import { MEMBER_ACTION_DEADLINE_PASSED } from "@alliance/common/actionActivity";
import {
  actionsQuery,
  dismissActionErrorMessage,
  useInvalidateActions,
} from "@alliance/shared/lib/actionsListPage";
import {
  noTasksContractSuspended,
  noTasksToDoRightNow,
} from "@alliance/shared/lib/copy";
import { homeItemKey, useHomePageActions } from "@alliance/shared/lib/homePage";
import { getTaskDismissInfo } from "@alliance/shared/lib/largeActionCard";
import {
  HOME_UPDATES_LIMIT,
  recentActionUpdatesQuery,
} from "@alliance/shared/lib/useActionUpdates";
import { useBoundedIndex } from "@alliance/shared/lib/useBoundedIndex";
import { unreadGeneralUpdatesQuery } from "@alliance/shared/lib/useGeneralUpdates";
import { useResetHomeFeed } from "@alliance/shared/lib/useHomeFeed";
import { prefetchFromLoader } from "@alliance/sharedweb/lib/queryClient";
import { useMediaQuery } from "@alliance/sharedweb/lib/useMediaQuery";
import CheckIcon from "@alliance/sharedweb/ui/icons/CheckIcon";
import Spinner from "@alliance/sharedweb/ui/Spinner";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { useEffect, useMemo, useRef } from "react";
import FollowUpFormPanel from "../../components/FollowUpFormPanel";
import HomeFeed from "../../components/HomeFeed";
import HomeGeneralUpdates from "../../components/HomeGeneralUpdates";
import HomeUpdatesCarousel from "../../components/HomeUpdatesCarousel";
import HomeUpdatesSidebar from "../../components/HomeUpdatesSidebar";
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

// AppLayout mounts this page only once /auth/me answers; starting the queries
// here runs them alongside it instead. The home feed is left to HomeFeed:
// served alongside the tasks, it roughly doubles their response time.
export function clientLoader() {
  prefetchFromLoader(actionsQuery);
  prefetchFromLoader(unreadGeneralUpdatesQuery);
  prefetchFromLoader(recentActionUpdatesQuery(HOME_UPDATES_LIMIT));
  return null;
}

// The page's queries keep themselves fresh; rerunning the loader on a
// search-only navigation, as the walkthrough's steps make, refetches them all.
export const shouldRevalidate = () => false;

const HomePage = () => {
  const resetHomeFeed = useResetHomeFeed();
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

    const generalUpdatesList = (
      <HomeGeneralUpdates
        generalUpdates={generalUpdates}
        failure={generalUpdatesFailure}
        onDismiss={handleDismissGeneralUpdate}
      />
    );

    return (
      <div
        className={
          "flex flex-col gap-y-8 sm:gap-y-12 lg:gap-y-16 py-4 sm:py-8 px-4 xl:px-0 max-w-3xl mx-auto relative"
        }
      >
        {isLargeScreen &&
          ((generalUpdates?.length ?? 0) > 0 || generalUpdatesFailure) && (
            <div className="flex flex-col gap-4">{generalUpdatesList}</div>
          )}

        <div className="flex flex-col gap-4 flex-1">
          <p className="text-base font-semibold text-black">Tasks</p>
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
                onCompleteAction={resetHomeFeed}
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
            <HomeUpdatesCarousel />
            {generalUpdatesList}
          </div>
        )}

        {!isLargeScreen && (
          <SidebarProgressBars entries={sidebarProgressBarEntries} />
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
    resetHomeFeed,
    invalidateActions,
    warning,
    toastError,
    activeCompletableFollowUpForms,
    isLargeScreen,
    mocked,
    sidebarProgressBarEntries,
  ]);

  const sidebarContent = useMemo(
    () => (
      <div className="pt-8 px-4 flex flex-col *:px-2 *:not-last:pb-4 h-[calc(100vh-var(--navbar-top-bar-height))]">
        <SidebarProgressBars entries={sidebarProgressBarEntries} />
        <HomeUpdatesSidebar />
      </div>
    ),
    [sidebarProgressBarEntries],
  );

  useWhiteBackground();

  // One layout at every width, so crossing the breakpoint doesn't remount
  // the task card and close a task flow open from it.
  return (
    <TwoColumnLayout
      main={mainContent}
      sidebar={isLargeScreen ? sidebarContent : undefined}
      noSidebarOverflow
      mainScrollRef={mainScrollRef}
    />
  );
};

export default HomePage;
