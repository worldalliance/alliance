import CheckIcon from "@alliance/sharedweb/ui/icons/CheckIcon";
import AggregateProgressBarBlock from "@alliance/sharedweb/ui/AggregateProgressBarBlock";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ActionDto, FollowUpForm } from "@alliance/shared/client";
import { Link, href } from "react-router";
import BasicErrorMessage from "../../components/BasicErrorMessage";
import GlobalFeed from "../../components/GlobalFeed";
import { useWhiteBackground } from "../../components/HtmlBackgroundManager";
import Spinner from "@alliance/sharedweb/ui/Spinner";
import TwoColumnLayout from "../../components/TwoColumnLayout";
import { useAuth } from "../../lib/AuthContext";
import { useCIDFromParams } from "../../lib/utils";
import LargeActionCard from "./LargeActionCard";
import { getTaskDismissInfo } from "@alliance/shared/lib/largeActionCard";
import LargeGeneralUpdateCard from "@alliance/sharedweb/ui/LargeGeneralUpdateCard";
import useGlobalFeed from "@alliance/shared/lib/useGlobalFeed";
import { useMediaQuery } from "../../lib/useMediaQuery";
import {
  ActionWithAwayStatus,
  homePagePriorityComparator,
  showActionInSidebarList,
} from "@alliance/shared/lib/actionUtils";
import {
  compareFollowUpFormsByStartDateDesc,
  useHomePageActions,
} from "@alliance/shared/lib/homePage";
import {
  noTasksContractSuspended,
  noTasksToDoRightNow,
} from "@alliance/shared/lib/copy";
import FollowUpFormPanel from "../../components/FollowUpFormPanel";
import { useTaskActionsData } from "../../lib/useTaskActionsData";
import HomeUpdatesRow from "../../components/HomeUpdatesRow";
import SeeAll from "../../components/SeeAll";
import HomeFeed from "../../components/HomeFeed";
import type { AggregateViewSchema } from "@alliance/common/forms/form-schema";
import { runAsync } from "@alliance/shared/lib/utils";
import { useBoundedIndex } from "@alliance/shared/lib/useBoundedIndex";
import {
  fetchTaskFormProgressViewsByFormId,
  mapFormViewsToActionIds,
  sidebarProgressActionCandidates,
} from "../../lib/fetchTaskFormProgressViews";
import {
  TaskNavigatorCompletedRow,
  TaskNavigatorTodoActionRow,
} from "./TaskNavigatorRow";

/** Ordered queue of main-column cards (action or follow-up) driven by the task navigator list. */
type TaskNavigatorItem =
  | { kind: "action"; action: ActionWithAwayStatus }
  | { kind: "followUpForm"; followUpForm: FollowUpForm; actionId: number };

function TaskNavigatorListShell({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden">
      <div className="flex flex-col gap-y-2">{children}</div>
    </div>
  );
}

const HomePage = () => {
  const queryClient = useQueryClient();
  const hasNoTasks = useRef(true);
  const {
    actions,
    generalUpdates,
    loading,
    handleDismissAction,
    handleDismissGeneralUpdate,
  } = useTaskActionsData({
    refetchInterval: hasNoTasks.current ? 60_000 : false,
  });

  const { user, refreshUser } = useAuth();
  const hasRefreshedForNoContract = useRef(false);

  useEffect(() => {
    if (user && !user.hasActiveContract && !hasRefreshedForNoContract.current) {
      hasRefreshedForNoContract.current = true;
      refreshUser();
    }
  }, [user, refreshUser]);

  const mainScrollRef = useRef<HTMLDivElement | null>(null);
  const [actionProgressViews, setActionProgressViews] = useState<
    Record<number, AggregateViewSchema[]>
  >({});

  const { items: globalFeedItems, loading: globalFeedLoading } = useGlobalFeed({
    limit: 10,
  });

  useCIDFromParams();

  const {
    todoActions,
    currentWeekTodoActions,
    nextWeekTodoActions,
    remainingTasksEstimatedTimeCurrentWeek,
    completedActions,
    activeCompletableFollowUpForms,
  } = useHomePageActions(actions);

  const numTodo = todoActions.filter(showActionInSidebarList).length;

  const hasOnboardingTasks = useMemo(
    () => todoActions.some((a) => a.onboarding),
    [todoActions],
  );

  const isLargeScreen = useMediaQuery("(min-width: 1150px)");

  useEffect(() => {
    if (!actions) {
      setActionProgressViews({});
      return;
    }

    const candidates = sidebarProgressActionCandidates(actions);
    if (candidates.length === 0) {
      setActionProgressViews({});
      return;
    }

    let cancelled = false;
    const formIds = candidates.map((c) => c.formId);

    runAsync(async () => {
      const viewsByFormId = await fetchTaskFormProgressViewsByFormId(formIds);
      if (cancelled) {
        return;
      }
      setActionProgressViews(
        mapFormViewsToActionIds(candidates, viewsByFormId),
      );
    });

    return () => {
      cancelled = true;
    };
  }, [actions]);

  const sidebarProgressActions = useMemo(() => {
    if (!actions) {
      return [];
    }
    return actions
      .filter(
        (action) =>
          action.status === "member_action" &&
          action.shouldParticipate &&
          (actionProgressViews[action.id]?.some(
            (v) => v.kind === "progressbar",
          ) ??
            false),
      )
      .sort(homePagePriorityComparator);
  }, [actionProgressViews, actions]);

  const followUpFormsByActionId = useMemo(() => {
    const map: Record<number, FollowUpForm[]> = {};
    for (const { followUpForm, actionId } of activeCompletableFollowUpForms) {
      (map[actionId] ??= []).push(followUpForm);
    }
    for (const forms of Object.values(map)) {
      forms.sort(compareFollowUpFormsByStartDateDesc);
    }
    return map;
  }, [activeCompletableFollowUpForms]);

  const followUpParentActionsNotInCompletedList = useMemo(() => {
    if (!actions) {
      return [];
    }
    const completedIds = new Set(completedActions.map((a) => a.id));
    const orphanIds = new Set<number>();
    for (const { actionId } of activeCompletableFollowUpForms) {
      if (!completedIds.has(actionId)) {
        orphanIds.add(actionId);
      }
    }
    return actions
      .filter((a) => orphanIds.has(a.id))
      .sort(homePagePriorityComparator);
  }, [actions, activeCompletableFollowUpForms, completedActions]);

  const taskNavigatorItems = useMemo<TaskNavigatorItem[]>(() => {
    const actionCards: TaskNavigatorItem[] = [...todoActions]
      .sort(homePagePriorityComparator)
      .map((action) => ({ kind: "action", action }) as const);

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

  hasNoTasks.current = taskNavigatorItems.length === 0;

  const { index: taskNavigatorIndex, setIndex: setTaskNavigatorIndex } =
    useBoundedIndex(taskNavigatorItems.length);

  const sortedGeneralUpdates = useMemo(
    () => [...(generalUpdates ?? [])].sort(homePagePriorityComparator),
    [generalUpdates],
  );

  const selectedTaskNavigatorItem = hasNoTasks.current
    ? undefined
    : taskNavigatorItems[taskNavigatorIndex];

  const taskNavigatorListContent = useMemo(() => {
    const taskNavigatorCurrentWeekSidebarActions =
      currentWeekTodoActions.filter(showActionInSidebarList);
    const activeActionId =
      selectedTaskNavigatorItem?.kind === "action"
        ? selectedTaskNavigatorItem.action.id
        : null;
    const activeFollowUpFormId =
      selectedTaskNavigatorItem?.kind === "followUpForm"
        ? selectedTaskNavigatorItem.followUpForm.id
        : null;
    const hasTaskSectionContent =
      taskNavigatorCurrentWeekSidebarActions.length > 0 ||
      completedActions.length > 0 ||
      followUpParentActionsNotInCompletedList.length > 0;
    return (
      <>
        {hasTaskSectionContent && (
          <TaskNavigatorListShell>
            {taskNavigatorCurrentWeekSidebarActions.length > 0 && (
              <p className="text-zinc-600 mb-1">
                <span className="text-green font-medium mr-0.5">
                  {taskNavigatorCurrentWeekSidebarActions.length} left
                </span>
                {numTodo > 0 &&
                  remainingTasksEstimatedTimeCurrentWeek > 0 &&
                  ` for a total of ${remainingTasksEstimatedTimeCurrentWeek} minutes`}
              </p>
            )}

            {/* Completed actions */}
            <div className="flex flex-col gap-y-1">
              {[
                ...completedActions,
                ...followUpParentActionsNotInCompletedList,
              ].map((action) => (
                <TaskNavigatorCompletedRow
                  key={action.id}
                  action={action}
                  followUpForms={followUpFormsByActionId[action.id] ?? []}
                  activeFollowUpFormId={activeFollowUpFormId}
                  onSelectFollowUp={(formId) => {
                    const idx = taskNavigatorItems.findIndex(
                      (c) =>
                        c.kind === "followUpForm" &&
                        c.actionId === action.id &&
                        c.followUpForm.id === formId,
                    );
                    if (idx >= 0) {
                      setTaskNavigatorIndex(idx);
                    }
                  }}
                />
              ))}

              {/* Actions in the current week */}
              {currentWeekTodoActions.map((action) => {
                const isActive = action.id === activeActionId;
                return (
                  <TaskNavigatorTodoActionRow
                    key={action.id}
                    action={action}
                    isActive={isActive}
                    showOptionalPrefix
                    onSelect={() => {
                      const idx = taskNavigatorItems.findIndex(
                        (c) => c.kind === "action" && c.action.id === action.id,
                      );
                      if (idx >= 0) {
                        setTaskNavigatorIndex(idx);
                      }
                    }}
                  />
                );
              })}
              {nextWeekTodoActions.length > 0 && (
                <>
                  <div className="pt-2">
                    <p className="text-zinc-500 font-medium">Upcoming</p>
                  </div>
                  {nextWeekTodoActions.map((action) => {
                    const isActive = action.id === activeActionId;
                    return (
                      <TaskNavigatorTodoActionRow
                        key={action.id}
                        action={action}
                        isActive={isActive}
                        showOptionalPrefix={false}
                        onSelect={() => {
                          const idx = taskNavigatorItems.findIndex(
                            (c) =>
                              c.kind === "action" && c.action.id === action.id,
                          );
                          if (idx >= 0) {
                            setTaskNavigatorIndex(idx);
                          }
                        }}
                      />
                    );
                  })}
                </>
              )}
            </div>
          </TaskNavigatorListShell>
        )}
      </>
    );
  }, [
    completedActions,
    currentWeekTodoActions,
    followUpFormsByActionId,
    followUpParentActionsNotInCompletedList,
    nextWeekTodoActions,
    numTodo,
    selectedTaskNavigatorItem,
    setTaskNavigatorIndex,
    taskNavigatorItems,
    remainingTasksEstimatedTimeCurrentWeek,
  ]);

  const sidebarProgressActionProgressBars = useMemo(() => {
    if (sidebarProgressActions.length === 0) {
      return <></>;
    }
    return (
      <>
        <div className="flex flex-col gap-y-3">
          <div className="flex flex-col gap-y-2">
            {sidebarProgressActions.map((action) => (
              <Link
                key={action.id}
                to={href("/actions/:id", { id: action.id.toString() })}
                className="block p-4 rounded bg-white hover:bg-grey-1"
              >
                <p className="text-sm font-medium text-green mb-2">
                  {action.name}
                </p>
                <div className="flex flex-col gap-y-2">
                  {(actionProgressViews[action.id] ?? [])
                    .filter((v) => v.kind === "progressbar")
                    .map((view) => (
                      <AggregateProgressBarBlock
                        key={view.id}
                        view={view}
                        titleClassName="text-base font-medium text-black"
                        captionClassName="text-sm text-zinc-600"
                        className="flex flex-col gap-y-1"
                      />
                    ))}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </>
    );
  }, [sidebarProgressActions, actionProgressViews]);

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
        {!hasOnboardingTasks && (
          <div className="flex flex-col gap-4">
            {isLargeScreen && (
              <>
                <div className="flex flex-row justify-between items-center px-1">
                  <p className="text-title">Updates</p>
                  <SeeAll link="/action-updates" size="lg" />
                </div>
                <HomeUpdatesRow />
                {sortedGeneralUpdates.length > 0 && (
                  <div className="flex flex-col gap-3">
                    {sortedGeneralUpdates.map((generalUpdate) => (
                      <LargeGeneralUpdateCard
                        key={generalUpdate.id}
                        id={generalUpdate.id}
                        title={generalUpdate.name}
                        schema={generalUpdate.schema}
                        onDismiss={() =>
                          handleDismissGeneralUpdate(generalUpdate.id)
                        }
                        userId={user?.id}
                        user={user}
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            {!isLargeScreen && <div>{sidebarProgressActionProgressBars}</div>}
          </div>
        )}

        <div className="flex flex-col gap-4 flex-1">
          <p className="text-title">Tasks</p>
          {taskNavigatorListContent}

          {selectedTaskNavigatorItem?.kind === "action" &&
          selectedTaskNavigatorItem.action.userRelation ? (
            <LargeActionCard
              action={selectedTaskNavigatorItem.action}
              dismissProps={
                taskDismissInfo
                  ? {
                      ...taskDismissInfo,
                      onDismiss: () =>
                        handleDismissAction(
                          selectedTaskNavigatorItem.action.id,
                        ),
                    }
                  : undefined
              }
              userRelation={selectedTaskNavigatorItem.action.userRelation}
              onCompleteAction={() => {
                queryClient.setQueryData<ActionDto[] | undefined>(
                  ["actions"],
                  (prev) =>
                    prev?.map((action) =>
                      action.id === selectedTaskNavigatorItem.action.id
                        ? { ...action, userRelation: "completed" as const }
                        : action,
                    ),
                );
                queryClient.invalidateQueries({ queryKey: ["actions"] });
              }}
              onUpdateActionState={() => {
                queryClient.invalidateQueries({ queryKey: ["actions"] });
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
              scrollContainerRef={mainScrollRef}
            />
          ) : selectedTaskNavigatorItem?.kind === "followUpForm" ? (
            <div className="w-full mx-auto">
              <FollowUpFormPanel
                key={selectedTaskNavigatorItem.followUpForm.id}
                followUpForm={selectedTaskNavigatorItem.followUpForm}
                actionId={selectedTaskNavigatorItem.actionId}
                onSubmitted={() => {
                  queryClient.invalidateQueries({
                    queryKey: ["actions"],
                  });
                }}
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
                              onSubmitted={() => {
                                queryClient.invalidateQueries({
                                  queryKey: ["actions"],
                                });
                              }}
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
            <div className="flex flex-row justify-between items-center px-1">
              <p className="text-title">Updates</p>
              <SeeAll link="/action-updates" size="lg" />
            </div>
            <HomeUpdatesRow />
            {sortedGeneralUpdates.length > 0 && (
              <div className="flex flex-col gap-3">
                {sortedGeneralUpdates.map((generalUpdate) => (
                  <LargeGeneralUpdateCard
                    key={generalUpdate.id}
                    id={generalUpdate.id}
                    title={generalUpdate.name}
                    schema={generalUpdate.schema}
                    onDismiss={() =>
                      handleDismissGeneralUpdate(generalUpdate.id)
                    }
                    userId={user?.id}
                    user={user}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        <HomeFeed />
      </div>
    );
  }, [
    actions,
    loading,
    selectedTaskNavigatorItem,
    user,
    handleDismissAction,
    handleDismissGeneralUpdate,
    sortedGeneralUpdates,
    taskNavigatorListContent,
    queryClient,
    activeCompletableFollowUpForms,
    hasOnboardingTasks,
    isLargeScreen,
    sidebarProgressActionProgressBars,
  ]);

  const sidebarContent = useMemo(() => {
    return (
      <div className="pt-6 px-4 flex flex-col *:pb-4 *:px-2 h-[calc(100vh-var(--navbar-top-bar-height))]">
        {sidebarProgressActionProgressBars}
        <div className="flex-1 min-h-0 flex flex-col">
          <GlobalFeed
            items={globalFeedItems}
            loading={globalFeedLoading}
            fitToHeight
          />
        </div>
      </div>
    );
  }, [globalFeedItems, globalFeedLoading, sidebarProgressActionProgressBars]);

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
