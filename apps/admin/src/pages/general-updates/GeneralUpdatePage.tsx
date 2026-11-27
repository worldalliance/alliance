import { thrownStatus } from "@alliance/shared/lib/hey-api";
import type { ReactNode } from "react";
import { useParams } from "react-router";
import { useContentConfirm } from "../../components/useContentConfirm";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { formatDateTime } from "../../lib/formatDate";
import { LAUNCH_TIME_ZONE } from "../../lib/launchTimeZone";
import { useActionSuitesAdmin } from "../../lib/useActionSuitesAdmin";
import { useGeneralUpdateAdmin } from "../../lib/useGeneralUpdateAdmin";
import { useGeneralUpdatesAdmin } from "../../lib/useGeneralUpdatesAdmin";
import { useTagsAdmin } from "../../lib/useTagsAdmin";
import { placeById, PlaceId, RecordId, tabHref } from "../../places";
import Badge from "../../ui/Badge";
import Button, { ButtonVariant } from "../../ui/Button";
import { Skeleton } from "../../ui/Skeleton";
import { Banner } from "../../ui/templates/Banner";
import { Page, PageBody } from "../../ui/templates/Page";
import {
  ContentState,
  FormSkeleton,
  LOAD_FAILED_FALLBACK,
  RefreshFailedBanner,
} from "../../ui/templates/States";
import { useRecordTabs } from "../../ui/templates/usePlaceTabs";
import { useSelectableUsers } from "../../ui/UserSelect";
import { GeneralUpdateContentTab } from "./GeneralUpdateContentTab";
import { GeneralUpdateDetailsTab } from "./GeneralUpdateDetailsTab";
import {
  GENERAL_UPDATES_HREF,
  LIVE_NOTICE,
  STATUS_LABEL,
  STATUS_TONE,
  statusOf,
} from "./generalUpdateRules";
import { useGeneralUpdateDetails } from "./useGeneralUpdateDetails";

const TABS = ["details", "content"] as const;
type Tab = (typeof TABS)[number];

const NEW = "new";

const SKELETON: Record<Tab, ReactNode> = {
  details: (
    <PageBody width="form">
      <FormSkeleton fields={5} />
    </PageBody>
  ),
  content: (
    <PageBody>
      <Skeleton className="h-96 w-full rounded-card" />
    </PageBody>
  ),
};

export default function GeneralUpdatePage() {
  const { id } = useParams();
  // Keyed, so the form of one record never carries over to the next.
  return <GeneralUpdateRecord key={id} idParam={id ?? NEW} />;
}

function GeneralUpdateRecord({ idParam }: { idParam: string }) {
  const isNew = idParam === NEW;
  const parsedId = isNew ? NaN : Number(idParam);
  const updateId = Number.isInteger(parsedId) ? parsedId : null;
  const tabs = useRecordTabs(RecordId.GeneralUpdate, TABS);

  const admin = useGeneralUpdateAdmin(updateId);
  const { query } = admin;
  const update = query.data;
  const { confirmSave, dialog: contentDialog } = useContentConfirm();
  const details = useGeneralUpdateDetails({ updateId, admin, confirmSave });
  const tags = useTagsAdmin();
  const { suites } = useActionSuitesAdmin();
  const users = useSelectableUsers();

  // The server answers a missing general update with a 500, so a fresh list
  // without the id is what tells "not found" from a failed load.
  const list = useGeneralUpdatesAdmin();
  const listed = list.data?.find((candidate) => candidate.id === updateId);
  const missingFromList =
    query.isError && list.isSuccess && list.isFetchedAfterMount && !listed;
  const notFound =
    !isNew &&
    (updateId === null || thrownStatus(query.error) === 404 || missingFromList);
  // While the fresh list is on its way a failed load may yet be "not found".
  const failed =
    query.isError && !(list.isFetching && !list.isFetchedAfterMount);
  const loading = !notFound && !details.filled && !failed;
  const status = update && statusOf(update, new Date());
  // The list a visit usually comes from already knows the status, so the
  // banner neither arrives late nor leaves a gap.
  const noticeFrom = update ?? listed;
  const notice = noticeFrom && LIVE_NOTICE[statusOf(noticeFrom, new Date())];

  const detailsTab = (
    <GeneralUpdateDetailsTab
      details={details}
      isNew={isNew}
      suites={suites}
      tags={tags}
      users={users}
    />
  );
  const body: Record<Tab, () => ReactNode> = {
    details: () => detailsTab,
    content: () =>
      update && (
        <GeneralUpdateContentTab
          update={update}
          saveSchema={admin.saveSchema}
        />
      ),
  };

  const managePriority = (
    <Button
      variant={ButtonVariant.Default}
      to={tabHref(placeById(PlaceId.AllTasks), { view: "priority" })}
    >
      Manage priority
    </Button>
  );

  if (isNew) {
    return (
      <Page
        record={RecordId.GeneralUpdate}
        title="New general update"
        description="Members see nothing of it until its start date has passed."
        actions={managePriority}
      >
        {contentDialog}
        {detailsTab}
      </Page>
    );
  }

  return (
    <Page
      record={RecordId.GeneralUpdate}
      title={update?.name}
      badge={
        status && (
          <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
        )
      }
      description={
        update
          ? [
              update.startDate
                ? `Starts ${formatDateTime(update.startDate, { timeZone: LAUNCH_TIME_ZONE })}`
                : "No start date",
              update.endDate
                ? `Ends ${formatDateTime(update.endDate, { timeZone: LAUNCH_TIME_ZONE })}`
                : "No end date",
              ...(update.suites?.length
                ? [
                    `${update.suites.length === 1 ? "Suite" : "Suites"}: ${update.suites.map((suite) => suite.name).join(", ")}`,
                  ]
                : []),
            ].join(" · ")
          : ""
      }
      actions={managePriority}
      tabs={tabs}
      banner={
        <>
          <RefreshFailedBanner things="this general update" query={query} />
          {notice && <Banner>{notice}</Banner>}
        </>
      }
      bannerPending={loading && !noticeFrom}
    >
      {contentDialog}
      <ContentState
        loading={loading}
        skeleton={SKELETON[tabs.value]}
        error={
          !notFound && !details.filled && failed
            ? adminRefusalMessage(query.error, LOAD_FAILED_FALLBACK)
            : null
        }
        errorTitle="Couldn't load this general update"
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
        empty={notFound}
        emptyTitle="General update not found"
        emptyDescription="Check the link, or find it in the list."
        emptyAction={
          <Button variant={ButtonVariant.Default} to={GENERAL_UPDATES_HREF}>
            All general updates
          </Button>
        }
      >
        {body[tabs.value]()}
      </ContentState>
    </Page>
  );
}
