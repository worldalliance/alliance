import { ExternalLink, Pencil } from "lucide-react";
import { Link } from "react-router";
import { getSiteUrl } from "../../lib/config";

export const iconControlClass =
  "rounded p-1.5 text-zinc-600 hover:bg-zinc-100 hover:text-black";

export const EditActionLink = ({ actionId }: { actionId: number }) => (
  <Link
    to={`/actions/${actionId}`}
    target="_blank"
    rel="noreferrer"
    aria-label="Edit action"
    title="Edit action"
    className={iconControlClass}
  >
    <Pencil className="size-4" />
  </Link>
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
