import { ExternalLink, FileText, Pencil, ScanEye } from "lucide-react";
import type React from "react";
import { Link } from "react-router";
import { getSiteUrl } from "../../lib/config";
import { formEditorPath, formPreviewPath } from "../../lib/formEditorLink";
import {
  selectionSearch,
  type LinkedSelection,
} from "../../lib/linkedSelection";

export const iconControlClass =
  "rounded p-1.5 text-zinc-600 hover:bg-zinc-100 hover:text-black";

const NewTabLink = ({
  to,
  label,
  children,
}: React.PropsWithChildren<{ to: string; label: string }>) => (
  <Link
    to={to}
    target="_blank"
    rel="noreferrer"
    aria-label={label}
    title={label}
    className={iconControlClass}
  >
    {children}
  </Link>
);

export const EditActionLink = ({
  actionId,
  select,
}: {
  actionId: number;
  /** Opens the action's details with this text selected. */
  select?: LinkedSelection;
}) => (
  <NewTabLink
    to={
      select
        ? `/actions/${actionId}?tab=details&${selectionSearch(select)}`
        : `/actions/${actionId}`
    }
    label={select ? "Edit this text" : "Edit action"}
  >
    <Pencil className="size-4" />
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
    to={elementId ? formEditorPath(formId, elementId) : `/forms/${formId}`}
    label={elementId ? "Edit this text in the form" : "Edit task form"}
  >
    <FileText className="size-4" />
  </NewTabLink>
);

export const PreviewTaskFormLink = ({
  formId,
  userId,
}: {
  formId: number;
  userId: number;
}) => (
  <NewTabLink
    to={formPreviewPath(formId, userId)}
    label="Preview task form as this member"
  >
    <ScanEye className="size-4" />
  </NewTabLink>
);

export const ActionLinks = ({ actionId }: { actionId: number }) => (
  <>
    <a
      href={`${getSiteUrl()}/actions/${actionId}`}
      target="_blank"
      rel="noreferrer"
      aria-label="Preview action page"
      title="Preview action page"
      className={iconControlClass}
    >
      <ExternalLink className="size-4" />
    </a>
    <EditActionLink actionId={actionId} />
  </>
);
