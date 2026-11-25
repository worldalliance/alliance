import type { ActionSuiteDto } from "@alliance/shared/client";
import { thrownStatus } from "@alliance/shared/lib/hey-api";
import type { ReactNode } from "react";
import { Fragment, useMemo, useState } from "react";
import {
  href,
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { formatDateTime } from "../../lib/formatDate";
import { countOf } from "../../lib/formatNumber";
import { suiteHref, taskHref } from "../../lib/hrefs";
import { LAUNCH_TIME_ZONE } from "../../lib/launchTimeZone";
import { refetchFresh } from "../../lib/refetchFresh";
import { useActionSuiteAdmin } from "../../lib/useActionSuiteAdmin";
import { RecordId, TabParam } from "../../places";
import Button, { ButtonVariant } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { Skeleton } from "../../ui/Skeleton";
import { nameLinkClass } from "../../ui/styles";
import { Banner, BannerTone } from "../../ui/templates/Banner";
import { Page, PageBody } from "../../ui/templates/Page";
import {
  Fact,
  FactList,
  RecordBody,
  SidePanelSection,
} from "../../ui/templates/Record";
import {
  ContentState,
  LOAD_FAILED_FALLBACK,
  RefreshFailedBanner,
} from "../../ui/templates/States";
import { useRecordTabs } from "../../ui/templates/usePlaceTabs";
import { SuiteEventsTab } from "./SuiteEventsTab";
import { SuiteGeneralUpdatesTab } from "./SuiteGeneralUpdatesTab";
import { SuiteLaunchTab } from "./SuiteLaunchTab";
import { SuitePartitionTab } from "./SuitePartitionTab";
import { SuitePhaseBadge } from "./SuitePhaseBadge";
import { SuiteRemindersTab } from "./SuiteRemindersTab";
import {
  isScheduled,
  LaunchStatus,
  REMINDER_PARAM,
  suiteDates,
  suiteLaunch,
  suitePhase,
  suiteReminderHref,
} from "./suiteRules";
import { SuiteTasksTab } from "./SuiteTasksTab";
import { SuiteTimelineTab } from "./SuiteTimelineTab";

const TABS = [
  "timeline",
  "tasks",
  "events",
  "reminders",
  "general-updates",
  "partition",
  "launch",
] as const;
type Tab = (typeof TABS)[number];

/** Tabs that show "No tasks yet" in place of their body on a suite with none. */
const NEEDS_TASKS: Record<Tab, boolean> = {
  timeline: true,
  tasks: true,
  events: true,
  reminders: true,
  "general-updates": false,
  partition: true,
  launch: true,
};

const eventTime = (date: string) =>
  formatDateTime(date, { weekday: true, timeZone: LAUNCH_TIME_ZONE });

const sideSkeleton = (
  <div className="flex flex-col gap-3">
    {Array.from({ length: 5 }, (_, index) => (
      <Skeleton key={index} className="h-5 w-full" />
    ))}
  </div>
);

export default function SuitePage() {
  const { suiteId: param } = useParams();
  const suiteId = Number(param);
  const validId = Number.isSafeInteger(suiteId);
  const tabs = useRecordTabs(RecordId.Suite, TABS);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [eventError, setEventError] = useState<string | null>(null);
  const {
    suite: suiteQuery,
    addEvent,
    updateEvent,
    deleteEvent,
  } = useActionSuiteAdmin(suiteId);

  const suite = suiteQuery.data;
  const now = useMemo(
    () => new Date(suiteQuery.dataUpdatedAt),
    [suiteQuery.dataUpdatedAt],
  );
  const missing =
    !validId || (suiteQuery.isError && thrownStatus(suiteQuery.error) === 404);
  const loadError =
    !missing && suiteQuery.isLoadingError
      ? adminRefusalMessage(suiteQuery.error, LOAD_FAILED_FALLBACK)
      : null;

  const recordHref = suiteHref(suiteId);
  const tabHref = (tab: Tab) => `${recordHref}?${TabParam.Tab}=${tab}`;
  const newTaskHref = `/tasks/new?suiteId=${suiteId}`;
  const highlighted = Number(searchParams.get(REMINDER_PARAM));

  const handleDeleteEvent = async (eventId: number) => {
    setEventError(null);
    try {
      await deleteEvent.mutateAsync(eventId);
      return true;
    } catch (e) {
      setEventError(
        `${adminRefusalMessage(e, "Couldn't delete the event.")} (an event a project update is tied to can't be deleted)`,
      );
      return false;
    }
  };

  const launch = suite && suiteLaunch(suite);
  const launched = launch?.status === LaunchStatus.Launched;
  const phase = suite && suitePhase(suite.events, now);
  const dates = suite ? suiteDates(suite.events) : null;
  const visibleTasks =
    suite?.actions.filter((action) => action.status !== "draft").length ?? 0;
  const shownUpdates =
    suite?.generalUpdates.filter(
      (update) => update.startDate && new Date(update.startDate) < now,
    ).length ?? 0;
  const scheduled =
    phase !== undefined && isScheduled(phase, dates?.membersStart ?? null);
  // A task's own members taking action event opens it at that date, launch or
  // not, as a general update shows from its start. Once launched, the server
  // moves the suite's general updates to its members start, so only what opens
  // before that is early.
  const opensAt =
    scheduled && dates?.membersStart ? new Date(dates.membersStart) : null;
  const opensEarly = (date: string) =>
    new Date(date) >= now && (opensAt === null || new Date(date) < opensAt);
  const draftKind = scheduled ? "scheduled" : "draft";
  const notAtOpening = scheduled
    ? "before the suite's members start"
    : "not at launch";
  const ownOpenings =
    suite?.actions
      .filter((action) => action.status === "draft")
      .flatMap((action) =>
        action.events
          .filter(
            (event) =>
              !event.suiteManaged &&
              event.newStatus === "member_action" &&
              opensEarly(event.date),
          )
          .map((event) => event.date)
          .sort()
          .slice(0, 1),
      )
      .sort() ?? [];
  const upcomingUpdates =
    suite?.generalUpdates
      .flatMap((update) =>
        update.startDate && opensEarly(update.startDate)
          ? [update.startDate]
          : [],
      )
      .sort() ?? [];
  const hidden =
    phase === "draft" &&
    visibleTasks === 0 &&
    shownUpdates === 0 &&
    ownOpenings.length === 0 &&
    upcomingUpdates.length === 0;

  const body: Record<Tab, (shown: ActionSuiteDto) => ReactNode> = {
    timeline: (shown) => (
      <SuiteTimelineTab
        suite={shown}
        onReminderClick={(reminderId) =>
          void navigate(suiteReminderHref({ suiteId, reminderId }))
        }
      />
    ),
    tasks: (shown) => <SuiteTasksTab suite={shown} />,
    events: (shown) => (
      <SuiteEventsTab
        suite={shown}
        addEvent={addEvent.mutateAsync}
        updateEvent={(eventId, body) =>
          updateEvent.mutateAsync({ eventId, body })
        }
        deleteEvent={handleDeleteEvent}
      />
    ),
    reminders: (shown) => (
      <SuiteRemindersTab
        suite={shown}
        highlightedReminder={
          Number.isSafeInteger(highlighted) && highlighted > 0
            ? highlighted
            : null
        }
      />
    ),
    "general-updates": (shown) => <SuiteGeneralUpdatesTab suite={shown} />,
    partition: (shown) => (
      <SuitePartitionTab suite={shown} launched={launched} />
    ),
    launch: (shown) => (
      <SuiteLaunchTab
        suite={shown}
        launch={suiteLaunch(shown)}
        eventsHref={tabHref("events")}
        addEvent={addEvent.mutateAsync}
        fetchSuite={() => refetchFresh(suiteQuery.refetch)}
        onClose={() => void navigate(recordHref)}
      />
    ),
  };

  const noTasks = (
    <EmptyState
      title="No tasks yet"
      description="Tasks you add start as drafts in this suite."
      action={
        <Button variant={ButtonVariant.Primary} to={newTaskHref}>
          New task
        </Button>
      }
    />
  );

  const side = suite && phase && dates && (
    <SidePanelSection title="Details">
      <FactList>
        <Fact label="Status">
          <SuitePhaseBadge phase={phase} scheduled={scheduled} />
        </Fact>
        <Fact label="Members start">
          {dates.membersStart
            ? eventTime(dates.membersStart)
            : launch?.status === LaunchStatus.Ready
              ? "Set at launch"
              : "—"}
        </Fact>
        <Fact label="Deadline">
          {dates.deadline
            ? eventTime(dates.deadline)
            : launch?.status === LaunchStatus.Ready
              ? "Set at launch"
              : "—"}
        </Fact>
        <Fact label="Tasks">
          {suite.actions.length === 1 ? (
            <Link to={taskHref(suite.actions[0].id)} className={nameLinkClass}>
              {suite.actions[0].name}
            </Link>
          ) : (
            countOf(suite.actions.length, "task")
          )}
        </Fact>
        <Fact label="Partition">{suite.isPartitioned ? "On" : "Off"}</Fact>
      </FactList>
    </SidePanelSection>
  );

  const content = suite && (
    // Unsaved work on a tab, such as parts, belongs to one suite: moving to
    // another starts each tab clean.
    <Fragment key={suiteId}>
      {suite.actions.length === 0 && NEEDS_TASKS[tabs.value]
        ? noTasks
        : body[tabs.value](suite)}
    </Fragment>
  );

  const offerLaunch =
    launch?.status === LaunchStatus.Ready &&
    (suite?.actions.length ?? 0) > 0 &&
    tabs.value !== "launch";
  const actions = suite && launch && (
    <>
      {launch.status === LaunchStatus.Refused && (
        <p className="max-w-xs text-caption text-fg-muted">{launch.reason}</p>
      )}
      <Button variant={ButtonVariant.Default} to={newTaskHref}>
        New task
      </Button>
      {offerLaunch && (
        <Button variant={ButtonVariant.Primary} to={tabHref("launch")}>
          Launch…
        </Button>
      )}
    </>
  );

  return (
    <Page
      record={RecordId.Suite}
      title={suite?.name}
      badge={phase && <SuitePhaseBadge phase={phase} scheduled={scheduled} />}
      description={
        suite && dates
          ? [
              dates.membersStart &&
                `Members start ${eventTime(dates.membersStart)}`,
              dates.deadline && `deadline ${eventTime(dates.deadline)}`,
              countOf(suite.actions.length, "task"),
              suite.isPartitioned && "Partitioned",
            ]
              .filter(Boolean)
              .join(" · ")
          : ""
      }
      actions={actions}
      tabs={tabs}
      bannerPending={validId && suiteQuery.isPending}
      banner={
        <>
          <RefreshFailedBanner things="this suite" query={suiteQuery} />
          {hidden && (
            <Banner>
              {scheduled && dates?.membersStart
                ? `Nothing is visible to members until they start, ${eventTime(dates.membersStart)}.`
                : "Nothing is visible to members until you launch."}
            </Banner>
          )}
          {phase === "draft" && visibleTasks > 0 && (
            <Banner tone={BannerTone.Warning}>
              {countOf(visibleTasks, "task")} of this {draftKind} suite{" "}
              {visibleTasks === 1 ? "is" : "are"} already visible to members
              through events of {visibleTasks === 1 ? "its" : "their"} own.
            </Banner>
          )}
          {phase === "draft" && shownUpdates > 0 && (
            <Banner tone={BannerTone.Warning}>
              {countOf(shownUpdates, "general update")} of this {draftKind}{" "}
              suite {shownUpdates === 1 ? "is" : "are"} already shown to
              members.
            </Banner>
          )}
          {phase === "draft" && ownOpenings.length > 0 && (
            <Banner tone={BannerTone.Warning}>
              {countOf(ownOpenings.length, "task")} of this {draftKind} suite{" "}
              {ownOpenings.length === 1 ? "opens" : "open"} to members from{" "}
              {eventTime(ownOpenings[0])} through events of{" "}
              {ownOpenings.length === 1 ? "its" : "their"} own, {notAtOpening}.
            </Banner>
          )}
          {phase === "draft" && upcomingUpdates.length > 0 && (
            <Banner tone={BannerTone.Warning}>
              {countOf(upcomingUpdates.length, "general update")} of this{" "}
              {draftKind} suite {upcomingUpdates.length === 1 ? "is" : "are"}{" "}
              shown to members from {eventTime(upcomingUpdates[0])},{" "}
              {notAtOpening}.
            </Banner>
          )}
          {eventError && (
            <Banner
              tone={BannerTone.Danger}
              action={
                <Button
                  size="small"
                  variant={ButtonVariant.Ghost}
                  onClick={() => setEventError(null)}
                >
                  Dismiss
                </Button>
              }
            >
              {eventError}
            </Banner>
          )}
        </>
      }
    >
      <ContentState
        loading={validId && suiteQuery.isPending}
        skeleton={
          tabs.value === "launch" ? (
            <PageBody>{sideSkeleton}</PageBody>
          ) : (
            <RecordBody side={sideSkeleton}>
              <Skeleton className="h-80 w-full rounded-card" />
            </RecordBody>
          )
        }
        error={loadError}
        errorTitle="Couldn't load this suite"
        onRetry={() => void suiteQuery.refetch()}
        retrying={suiteQuery.isFetching}
        empty={missing || !suite}
        emptyTitle="Suite not found"
        emptyAction={
          <Button variant={ButtonVariant.Default} to={href("/tasks/suites")}>
            All suites
          </Button>
        }
      >
        {tabs.value === "launch" ? (
          <PageBody>{content}</PageBody>
        ) : (
          <RecordBody side={side}>{content}</RecordBody>
        )}
      </ContentState>
    </Page>
  );
}
