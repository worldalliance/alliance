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
import { Banner, BannerTone } from "../../ui/templates/Banner";
import { Page, PageBody } from "../../ui/templates/Page";
import { ContentState, LOAD_FAILED_FALLBACK } from "../../ui/templates/States";
import { useRecordTabs } from "../../ui/templates/usePlaceTabs";
import { useSelectableUsers } from "../../ui/UserSelect";
import { GeneralUpdateContentTab } from "./GeneralUpdateContentTab";
import { GeneralUpdateDetailsTab } from "./GeneralUpdateDetailsTab";
import {
  GENERAL_UPDATES_HREF,
  GeneralUpdateStatus,
  STATUS_LABEL,
  STATUS_TONE,
  statusOf,
} from "./generalUpdateRules";
import { useGeneralUpdateDetails } from "./useGeneralUpdateDetails";

const TABS = ["details", "content"] as const;
type Tab = (typeof TABS)[number];

const NEW = "new";

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
  const missingFromList =
    query.isError &&
    list.isSuccess &&
    list.isFetchedAfterMount &&
    !list.data.some((listed) => listed.id === updateId);
  const notFound =
    !isNew &&
    (updateId === null || thrownStatus(query.error) === 404 || missingFromList);
  const status = update && statusOf(update, new Date());

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
        description="Nothing is shown to members until the update has a start date or a suite."
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
        status === GeneralUpdateStatus.Active && (
          <Banner tone={BannerTone.Info}>
            Members in this update&apos;s audience can see it now. A save to its
            details or its content reaches them on their next load.
          </Banner>
        )
      }
    >
      {contentDialog}
      <ContentState
        loading={!notFound && !details.filled && !query.isError}
        skeleton={
          <PageBody width="form">
            <Skeleton className="h-96 w-full rounded-card" />
          </PageBody>
        }
        error={
          !notFound && !details.filled && query.isError
            ? adminRefusalMessage(query.error, LOAD_FAILED_FALLBACK)
            : null
        }
        errorTitle="Couldn't load this general update"
        onRetry={() => void query.refetch()}
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
