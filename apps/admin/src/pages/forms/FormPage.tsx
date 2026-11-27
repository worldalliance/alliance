import { thrownStatus } from "@alliance/shared/lib/hey-api";
import { useFormsAdmin } from "@alliance/shared/lib/useFormsAdmin";
import { useAdminTaskForm } from "@alliance/shared/lib/useTaskForm";
import type { ReactNode } from "react";
import { href, Link, useParams } from "react-router";
import { taskHref } from "../../lib/hrefs";
import { RecordId } from "../../places";
import Button, { ButtonVariant } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { Skeleton } from "../../ui/Skeleton";
import { linkClass } from "../../ui/styles";
import { Page } from "../../ui/templates/Page";
import { ContentState, TableSkeleton } from "../../ui/templates/States";
import { useRecordTabs } from "../../ui/templates/usePlaceTabs";
import FormBuilder from "../FormBuilder";
import FormResponses from "../FormResponses";
import { formTitle } from "./formRules";
import { FormVersionsTab } from "./FormVersionsTab";

const TABS = ["builder", "responses", "versions"] as const;
type Tab = (typeof TABS)[number];

/** The Builder and Responses tabs fill the frame and scroll inside it. */
const FILLS: Record<Tab, boolean> = {
  builder: true,
  responses: true,
  versions: false,
};

const NEW = "new";

/**
 * A frame-height slot for a tab whose content fills it and scrolls inside
 * (`flex-1 min-h-0`, or `h-full`). Content taller than the slot scrolls here,
 * under the record's header and tabs.
 */
function FillSlot({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">{children}</div>
  );
}

/** Null for a tab that needs only the form id, so it loads alongside the form. */
const SKELETON: Record<Tab, ReactNode> = {
  builder: (
    <div className="flex min-h-0 flex-1 gap-section px-page pt-section">
      <Skeleton className="h-64 w-72 shrink-0" />
      <Skeleton className="h-96 flex-1" />
      <Skeleton className="h-64 w-80 shrink-0" />
    </div>
  ),
  responses: <TableSkeleton bleed columns={6} />,
  versions: null,
};

const BODY: Record<Tab, (formId: number) => ReactNode> = {
  builder: () => (
    <FillSlot>
      <FormBuilder />
    </FillSlot>
  ),
  responses: () => (
    <FillSlot>
      <FormResponses />
    </FillSlot>
  ),
  versions: (formId) => <FormVersionsTab formId={formId} />,
};

export default function FormPage() {
  const { formId: param } = useParams();
  if (param === NEW) return <NewFormPage />;
  // Keyed so a tab's state never carries from one form to the next.
  return <FormRecordPage key={param} param={param ?? ""} />;
}

/**
 * `/tasks/forms/new`, reachable by URL only: the builder with no form yet.
 * Its first save creates the form and opens the new record.
 */
function NewFormPage() {
  return (
    <Page fill record={RecordId.Form} title="New form">
      <FillSlot>
        <FormBuilder />
      </FillSlot>
    </Page>
  );
}

function FormRecordPage({ param }: { param: string }) {
  const formId = /^\d+$/.test(param) ? Number(param) : null;
  const tabs = useRecordTabs(RecordId.Form, TABS);
  const form = useAdminTaskForm(formId);
  const {
    forms,
    isLoading: listLoading,
    isError: listFailed,
  } = useFormsAdmin();
  const listed = forms.find((candidate) => candidate.id === formId);
  const notFound =
    formId === null || (form.isError && thrownStatus(form.error) === 404);

  const task = listed?.usedInAction;
  const description = !form.data ? (
    ""
  ) : task ? (
    <>
      Form {form.data.id} · Task{" "}
      <Link to={taskHref(task.id)} className={linkClass}>
        {task.name}
      </Link>
    </>
  ) : listed || listLoading ? (
    // The index names no task for a follow-up form, so no task here proves nothing.
    `Form ${form.data.id}`
  ) : (
    // The task comes from the forms index, which failed or lacks this form.
    `Form ${form.data.id} · Task —${listFailed ? " (couldn't load)" : ""}`
  );

  return (
    <Page
      fill={FILLS[tabs.value]}
      record={RecordId.Form}
      title={form.data ? formTitle(form.data) : undefined}
      description={description}
      tabs={tabs}
    >
      {notFound ? (
        <EmptyState
          title="Form not found"
          description="It may have been deleted."
          action={
            <Button variant={ButtonVariant.Default} to={href("/tasks/forms")}>
              All forms
            </Button>
          }
        />
      ) : formId !== null && SKELETON[tabs.value] === null ? (
        BODY[tabs.value](formId)
      ) : (
        <ContentState
          things="form"
          query={form}
          errorTitle="Couldn't load this form"
          skeleton={SKELETON[tabs.value]}
        >
          {formId !== null && BODY[tabs.value](formId)}
        </ContentState>
      )}
    </Page>
  );
}
