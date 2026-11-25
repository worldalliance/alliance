import type { ReactNode } from "react";
import { Link } from "react-router";
import { getSiteUrl } from "../../../lib/config";
import { formEditorPath, formPreviewPath } from "../../../lib/formEditorLink";
import { taskHref } from "../../../lib/hrefs";
import {
  selectionSearch,
  type LinkedSelection,
} from "../../../lib/linkedSelection";
import NewTabMark from "../../../ui/NewTabMark";
import { linkClass } from "../../../ui/styles";

/**
 * A link that opens beside the launch, so its progress stays on screen.
 * `label` names what it opens where the visible word alone doesn't.
 */
export function NewTabLink({
  to,
  label,
  children,
}: {
  to: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      className={linkClass}
    >
      {children}
      <NewTabMark />
    </Link>
  );
}

export const EditTaskLink = ({
  actionId,
  select,
}: {
  actionId: number;
  select?: LinkedSelection;
}) => (
  <NewTabLink
    to={
      select
        ? `${taskHref(actionId)}?tab=details&${selectionSearch(select)}`
        : taskHref(actionId)
    }
    label={select ? "Edit this text" : "Edit task"}
  >
    Edit
  </NewTabLink>
);

export const EditTaskFormLink = ({
  formId,
  elementId,
}: {
  formId: number;
  /** Opens the form with this page or element selected. */
  elementId?: string | null;
}) => (
  <NewTabLink
    to={
      elementId ? formEditorPath(formId, elementId) : `/tasks/forms/${formId}`
    }
    label={elementId ? "Edit this text in the form" : "Edit task form"}
  >
    {elementId ? "Edit" : "Edit task form"}
  </NewTabLink>
);

export const PreviewTaskFormLink = ({
  formId,
  userId,
  variantName,
}: {
  formId: number;
  userId: number;
  variantName: string | null;
}) => (
  <NewTabLink
    to={formPreviewPath({ formId, userId })}
    label={
      variantName === null
        ? "Preview task form as this member"
        : `Preview variant “${variantName}” as this member`
    }
  >
    {variantName === null
      ? "Preview task form"
      : `Preview variant “${variantName}”`}
  </NewTabLink>
);

/** The task's page as members see it, on the members' site. */
export const PreviewTaskPageLink = ({ actionId }: { actionId: number }) => (
  <a
    href={`${getSiteUrl()}/actions/${actionId}`}
    target="_blank"
    rel="noreferrer"
    className={linkClass}
  >
    Preview page
    <NewTabMark />
  </a>
);

/** The task's own links, in the order staff check them. */
export const TaskLinks = ({
  actionId,
  taskFormId,
}: {
  actionId: number;
  taskFormId?: number | null;
}) => (
  <span className="flex shrink-0 items-center gap-3 text-caption">
    <PreviewTaskPageLink actionId={actionId} />
    <EditTaskLink actionId={actionId} />
    {taskFormId != null && <EditTaskFormLink formId={taskFormId} />}
  </span>
);
