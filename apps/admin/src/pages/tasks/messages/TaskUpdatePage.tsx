import {
  displayOnlyToFormSchema,
  readDisplayOnlySchema,
} from "@alliance/common/forms/display-only-schema";
import type { AdminActionUpdateDto } from "@alliance/shared/client";
import { thrownStatus } from "@alliance/shared/lib/hey-api";
import { useActionAdmin } from "@alliance/shared/lib/useActionAdmin";
import type { ReactNode } from "react";
import { useParams } from "react-router";
import { FormBuilder } from "../../../components/FormBuilder";
import { useContentConfirm } from "../../../components/useContentConfirm";
import { adminRefusalMessage } from "../../../lib/adminRefusal";
import { useActionUpdateAdmin } from "../../../lib/useActionUpdateAdmin";
import { RecordId } from "../../../places";
import Badge from "../../../ui/Badge";
import Button, { ButtonVariant } from "../../../ui/Button";
import { Skeleton } from "../../../ui/Skeleton";
import { Banner, BannerTone } from "../../../ui/templates/Banner";
import { Page, PageBody } from "../../../ui/templates/Page";
import {
  ContentState,
  FormSkeleton,
  LOAD_FAILED_FALLBACK,
  RefreshFailedBanner,
} from "../../../ui/templates/States";
import { useRecordTabs } from "../../../ui/templates/usePlaceTabs";
import { taskTabHref } from "../taskTabs";
import { UpdateDetailsTab } from "./UpdateDetailsTab";
import {
  notificationFactOf,
  pacific,
  VISIBILITY_BADGE,
  visibilityOf,
} from "./updateRules";
import { HiddenFromMembersBanner } from "./UpdateVisibilitySection";
import { useUpdateDetails } from "./useUpdateDetails";

const TABS = ["content", "details"] as const;
type Tab = (typeof TABS)[number];

const SKELETON: Record<Tab, ReactNode> = {
  content: <Skeleton className="m-page h-96 rounded-card" />,
  details: (
    <PageBody width="form">
      <FormSkeleton fields={6} />
    </PageBody>
  ),
};

const idOf = (param: string | undefined) => {
  const id = Number(param);
  return Number.isInteger(id) && id > 0 ? id : null;
};

/**
 * A project update: its content in the block editor, then its details, the
 * one-time notification and member visibility. A page rather than a sheet
 * over Messages, since staff work in its editor for long stretches.
 */
export default function TaskUpdatePage() {
  const params = useParams();
  const actionId = idOf(params.actionId);
  const updateId = actionId === null ? null : idOf(params.updateId);
  const tabs = useRecordTabs(RecordId.TaskUpdate, TABS);

  const admin = useActionUpdateAdmin(updateId);
  const { query } = admin;
  // A link pairing the update with another task would offer that task's
  // events as the update's associated event.
  const update = query.data?.actionId === actionId ? query.data : undefined;
  const task = useActionAdmin(actionId);
  const { confirmSave, dialog: contentDialog } = useContentConfirm();
  const details = useUpdateDetails({ updateId, admin, confirmSave });

  const notFound =
    updateId === null ||
    thrownStatus(query.error) === 404 ||
    (query.data !== undefined && update === undefined);
  const failed = !notFound && !details.filled && query.isError;
  const loading = !notFound && !details.filled && !failed;
  const ready = details.filled && details.form ? update : undefined;
  // The task the visit usually comes from already lists the update, so the
  // banner neither arrives late nor leaves a gap.
  const listed = task.action?.updates?.find((u) => u.id === updateId);
  const bannerFrom = ready ?? listed;
  const visibility = ready && visibilityOf(ready, new Date());

  const body: Record<Tab, () => ReactNode> = {
    content: () => update && <UpdateContent update={update} admin={admin} />,
    details: () =>
      update &&
      details.form && (
        <UpdateDetailsTab
          details={details}
          form={details.form}
          update={update}
          events={
            task.action ? (task.action.events ?? []) : task.isError ? null : []
          }
          admin={admin}
          onWritten={details.fill}
        />
      ),
  };

  return (
    <Page
      record={RecordId.TaskUpdate}
      title={ready?.title}
      parents={
        actionId === null
          ? []
          : [
              {
                label: task.action?.name ?? "Task",
                to: taskTabHref(actionId, "messages"),
              },
            ]
      }
      badge={
        visibility && (
          <Badge tone={VISIBILITY_BADGE[visibility.state].tone}>
            {VISIBILITY_BADGE[visibility.state].label}
          </Badge>
        )
      }
      description={
        ready
          ? `Dated ${pacific(ready.date)} · ${notificationFactOf(ready, new Date())}`
          : ""
      }
      tabs={tabs}
      fill={tabs.value === "content"}
      banner={
        <>
          <RefreshFailedBanner things="this project update" query={query} />
          {bannerFrom && <HiddenFromMembersBanner update={bannerFrom} />}
        </>
      }
      bannerPending={loading && !listed}
    >
      {contentDialog}
      <ContentState
        loading={loading}
        skeleton={SKELETON[tabs.value]}
        error={
          failed ? adminRefusalMessage(query.error, LOAD_FAILED_FALLBACK) : null
        }
        errorTitle="Couldn't load this project update"
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
        empty={notFound}
        emptyTitle="Project update not found"
        emptyDescription="It may have been deleted. Check the link, or find it on the task's Messages tab."
        emptyAction={
          actionId !== null && (
            <Button
              variant={ButtonVariant.Default}
              to={taskTabHref(actionId, "messages")}
            >
              Open the task&apos;s messages
            </Button>
          )
        }
      >
        {body[tabs.value]()}
      </ContentState>
    </Page>
  );
}

function UpdateContent({
  update,
  admin,
}: {
  update: AdminActionUpdateDto;
  admin: ReturnType<typeof useActionUpdateAdmin>;
}) {
  // Editing content this build can't parse would save back whatever the
  // builder made of it, dropping the parts it didn't understand.
  const storedSchema = readDisplayOnlySchema(update.schema);
  if (!storedSchema) {
    return (
      <PageBody>
        <Banner inline tone={BannerTone.Danger}>
          <p className="font-medium">This update can&apos;t be edited here</p>
          <p>
            Its content was saved by a newer version of the admin panel. Refresh
            the page to pick that version up.
          </p>
        </Banner>
      </PageBody>
    );
  }
  return (
    <FormBuilder
      displayOnly
      initialSchema={displayOnlyToFormSchema(storedSchema)}
      initialSnapshotId={update.schemaSnapshotId}
      title={update.title}
      setFormId={() => {}}
      onSave={admin.saveSchema}
    />
  );
}
