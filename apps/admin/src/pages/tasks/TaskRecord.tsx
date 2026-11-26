import { thrownStatus } from "@alliance/shared/lib/hey-api";
import {
  actionAdminQuery,
  useActionAdmin,
} from "@alliance/shared/lib/useActionAdmin";
import { useQuery } from "@tanstack/react-query";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "react-router";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { getSiteUrl } from "../../lib/config";
import { formatCount } from "../../lib/formatNumber";
import { useLinkedSelection } from "../../lib/linkedSelection";
import {
  type Crumb,
  placeById,
  PlaceId,
  tabHref,
  TabParam,
} from "../../places";
import Badge from "../../ui/Badge";
import Button, { ButtonVariant } from "../../ui/Button";
import NewTabMark from "../../ui/NewTabMark";
import PhaseBadge from "../../ui/PhaseBadge";
import { Skeleton } from "../../ui/Skeleton";
import { linkClass } from "../../ui/styles";
import { Banner, BannerTone } from "../../ui/templates/Banner";
import { Page, PageBody } from "../../ui/templates/Page";
import { RecordBody } from "../../ui/templates/Record";
import {
  ContentState,
  LOAD_FAILED_FALLBACK,
  RefreshFailedBanner,
} from "../../ui/templates/States";
import { useRecordTabs } from "../../ui/templates/usePlaceTabs";
import { useActionCommands } from "../action-dashboard/useActionCommands";
import { useActionEditor } from "../action-dashboard/useActionEditor";
import { useActionEditorLookups } from "../action-dashboard/useActionEditorLookups";
import { useActionExport } from "../action-dashboard/useActionExport";
import { ActivityTab } from "./activity/ActivityTab";
import { DetailsTab, NewTaskForm } from "./details/DetailsTab";
import { EventsTab } from "./events/EventsTab";
import { FollowUpFormsTab } from "./follow-up-forms/FollowUpFormsTab";
import { FormTab } from "./form/FormTab";
import { MessagesTab } from "./messages/MessagesTab";
import { OverviewTab } from "./overview/OverviewTab";
import { ResponsesTab } from "./responses/ResponsesTab";
import { TaskCommands } from "./TaskCommands";
import { COPY_GUIDELINES_URL, TaskSidePanel } from "./TaskSidePanel";
import {
  TASK_TAB_LAYOUT,
  TASK_TABS,
  type TaskRecordKind,
  type TaskTab,
  TaskTabLayout,
  type TaskTabProps,
} from "./taskTabs";
import { VariantsTab } from "./variants/VariantsTab";

const TAB_BODY: Record<TaskTab, (props: TaskTabProps) => ReactNode> = {
  overview: (props) => <OverviewTab {...props} />,
  details: (props) => <DetailsTab {...props} />,
  form: (props) => <FormTab {...props} />,
  variants: (props) => <VariantsTab {...props} />,
  "follow-up-forms": (props) => <FollowUpFormsTab {...props} />,
  messages: (props) => <MessagesTab {...props} />,
  responses: (props) => <ResponsesTab {...props} />,
  events: (props) => <EventsTab {...props} />,
  activity: (props) => <ActivityTab {...props} />,
};

const sideSkeleton = (
  <div className="flex flex-col gap-3">
    {[0, 1, 2, 3, 4, 5].map((row) => (
      <Skeleton key={row} className="h-5 w-full" />
    ))}
  </div>
);

const mainSkeleton = (
  <div className="flex flex-col gap-section">
    <Skeleton className="h-28 w-full rounded-card" />
    <Skeleton className="h-64 w-full rounded-card" />
  </div>
);

const SKELETON: Record<TaskTabLayout, ReactNode> = {
  [TaskTabLayout.Side]: (
    <RecordBody side={sideSkeleton}>{mainSkeleton}</RecordBody>
  ),
  [TaskTabLayout.Full]: <PageBody>{mainSkeleton}</PageBody>,
  [TaskTabLayout.Fill]: <PageBody>{mainSkeleton}</PageBody>,
};

export type TaskRoute =
  | { kind: "new" }
  /** `actionId` is `null` for an id that can't exist. */
  | { kind: "task"; actionId: number | null };

export type TaskRecordContext = {
  /** Details has edits not saved yet. */
  unsaved: boolean;
  /** A write to the task, such as a staff preview one, is running. */
  busy: boolean;
  setStaffPreview: (staffPreview: boolean) => Promise<void>;
  openTab: TaskTabProps["openTab"];
};

/**
 * The task record: header, commands, tabs, and the side panel of facts. A
 * task's own route and its project's route both render it; the project's
 * passes its crumb and the sections only it shows.
 */
export function TaskRecord({
  route,
  record,
  parents,
  sideExtra,
}: {
  route: TaskRoute;
  record: TaskRecordKind;
  parents?: readonly Crumb[];
  /**
   * Side panel sections after the facts, such as a project task's release.
   * It gets the page's Details editor state: a staff preview write must go
   * through the editor, or its stale draft undoes it on the next save.
   */
  sideExtra?: (context: TaskRecordContext) => ReactNode;
}) {
  const isNew = route.kind === "new";
  const actionId = route.kind === "task" ? route.actionId : null;
  const invalidId = route.kind === "task" && actionId === null;
  const admin = useActionAdmin(actionId);
  const query = useQuery(actionAdminQuery(actionId));
  const task = admin.action;
  const lookups = useActionEditorLookups();
  const [error, setError] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const tabs = useRecordTabs(record, TASK_TABS);
  const rootRef = useRef<HTMLDivElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);

  const editor = useActionEditor({
    admin,
    actionId,
    isNew,
    cohortParseFailed: admin.cohortExpressionError != null,
    lookups,
    searchParams,
    setError,
  });
  const notFound = invalidId || thrownStatus(query.error) === 404;
  const loadError =
    query.isLoadingError && !notFound
      ? adminRefusalMessage(query.error, LOAD_FAILED_FALLBACK)
      : null;
  const loading =
    !isNew &&
    !invalidId &&
    !query.isLoadingError &&
    (admin.isPending || !editor.draftSeeded);

  useLinkedSelection({
    ready: tabs.value === "details" && !loading && task !== null,
    searchParams,
    setSearchParams,
    onError: setError,
  });
  const commands = useActionCommands({
    admin,
    actionId,
    form: editor.form,
    imageKey: editor.imageKey,
    imageUploading: editor.imageUploading,
    setError,
  });
  const actionExport = useActionExport(actionId);

  // A failed write may come from far down a long tab; bring its banner into view.
  useEffect(() => {
    if (error)
      bannerRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
  }, [error]);

  const openTab = useCallback<TaskTabProps["openTab"]>(
    (tab, params = {}) => {
      setSearchParams(() => {
        const next = new URLSearchParams(params);
        if (tab !== TASK_TABS[0]) next.set(TabParam.Tab, tab);
        return next;
      });
      // The control that was pressed unmounts with its tab.
      rootRef.current
        ?.querySelector('[role="tablist"]')
        ?.querySelectorAll<HTMLElement>('[role="tab"]')
        [TASK_TABS.indexOf(tab)]?.focus();
    },
    [setSearchParams],
  );

  const memberPageUrl = task ? `${getSiteUrl()}/actions/${task.id}` : "";
  const layout = isNew ? TaskTabLayout.Full : TASK_TAB_LAYOUT[tabs.value];
  const tabProps: TaskTabProps | null = task && {
    task,
    record,
    admin,
    editor,
    lookups,
    openTab,
    setError,
  };

  const body = (shown: TaskTabProps) => {
    const content = TAB_BODY[tabs.value](shown);
    switch (layout) {
      case TaskTabLayout.Side:
        return (
          <RecordBody
            side={
              <TaskSidePanel
                task={shown.task}
                admin={admin}
                lookups={lookups}
                openTab={openTab}
                extra={sideExtra?.({
                  unsaved: editor.dirty,
                  busy: admin.isUpdating,
                  setStaffPreview: editor.setStaffPreview,
                  openTab,
                })}
              />
            }
          >
            {content}
          </RecordBody>
        );
      case TaskTabLayout.Full:
        return <PageBody>{content}</PageBody>;
      case TaskTabLayout.Fill:
        return content;
      default:
        throw new Error(`unknown layout: ${layout satisfies never}`);
    }
  };

  return (
    <div ref={rootRef} className="contents">
      <Page
        record={record}
        title={isNew ? "New task" : task?.name}
        parents={parents}
        fill={layout === TaskTabLayout.Fill}
        badge={
          task && (
            <span className="flex items-center gap-1.5">
              <PhaseBadge status={task.status} />
              {task.archived && <Badge>Archived</Badge>}
            </span>
          )
        }
        description={
          isNew ? undefined : task ? (
            <>
              {formatCount(task.usersJoined)}{" "}
              {task.optional ? "able" : "expected"} to complete ·{" "}
              {formatCount(task.usersCompleted)} completed · Before writing
              copy, read the{" "}
              <a
                href={COPY_GUIDELINES_URL}
                target="_blank"
                rel="noreferrer"
                className={linkClass}
              >
                copy guidelines
                <NewTabMark />
              </a>
            </>
          ) : (
            ""
          )
        }
        actions={
          task && (
            <TaskCommands
              task={task}
              commands={commands}
              actionExport={actionExport}
              imageUploading={editor.imageUploading}
              unsaved={editor.dirty}
              memberPageUrl={memberPageUrl}
            />
          )
        }
        tabs={isNew ? undefined : tabs}
        banner={
          <>
            <RefreshFailedBanner things="this task" query={query} />
            {error && (
              <div ref={bannerRef}>
                <Banner
                  tone={BannerTone.Danger}
                  action={
                    <Button
                      size="small"
                      variant={ButtonVariant.Ghost}
                      onClick={() => setError(null)}
                    >
                      Dismiss
                    </Button>
                  }
                >
                  {error}
                </Banner>
              </div>
            )}
            {lookups.allActionsLoadFailed && (
              <Banner tone={BannerTone.Warning}>
                Couldn't load the other tasks, so prerequisites and cohort
                conditions on other tasks can't be picked, and warnings about
                open references are missing.
              </Banner>
            )}
          </>
        }
      >
        {isNew ? (
          <PageBody width="form">
            <NewTaskForm admin={admin} editor={editor} lookups={lookups} />
          </PageBody>
        ) : (
          <ContentState
            loading={loading}
            skeleton={SKELETON[layout]}
            error={loadError}
            errorTitle="Couldn't load this task"
            onRetry={() => void query.refetch()}
            retrying={query.isFetching}
            empty={notFound || !tabProps}
            emptyTitle="Task not found"
            emptyAction={
              <Button
                variant={ButtonVariant.Default}
                to={tabHref(placeById(PlaceId.AllTasks), { view: "list" })}
              >
                All tasks
              </Button>
            }
          >
            {tabProps && body(tabProps)}
          </ContentState>
        )}
      </Page>
    </div>
  );
}
