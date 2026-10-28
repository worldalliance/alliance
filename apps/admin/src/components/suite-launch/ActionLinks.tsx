import { ExternalLink, FileText, Pencil } from "lucide-react";
import type React from "react";
import { Link } from "react-router";
import { getSiteUrl } from "../../lib/config";

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

export const EditActionLink = ({ actionId }: { actionId: number }) => (
  <NewTabLink to={`/actions/${actionId}`} label="Edit action">
    <Pencil className="size-4" />
  </NewTabLink>
);

export const EditTaskFormLink = ({ formId }: { formId: number }) => (
  <NewTabLink to={`/forms/${formId}`} label="Edit task form">
    <FileText className="size-4" />
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
