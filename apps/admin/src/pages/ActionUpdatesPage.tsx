import { withCount } from "@alliance/common/plural";
import type { ActionUpdateDto } from "@alliance/shared/client";
import { formatDateTime } from "@alliance/shared/lib/dateFormatters";
import { cn } from "@alliance/shared/styles/util";
import { useMemo } from "react";
import { href, Link } from "react-router";
import {
  ACTION_UPDATE_STATUS_LABELS,
  actionUpdateStatus,
  ActionUpdateStatus,
} from "../lib/actionUpdateStatus";
import { adminRefusalMessage } from "../lib/adminRefusal";
import { useAllActionUpdatesAdmin } from "../lib/useAllActionUpdatesAdmin";

const STATUS_ORDER = [
  ActionUpdateStatus.Draft,
  ActionUpdateStatus.Scheduled,
  ActionUpdateStatus.Published,
];

const STATUS_BADGE: Record<ActionUpdateStatus, string> = {
  [ActionUpdateStatus.Draft]: "bg-amber-100 text-amber-800",
  [ActionUpdateStatus.Scheduled]: "bg-blue-100 text-blue-800",
  [ActionUpdateStatus.Published]: "bg-green-100 text-green-800",
};

const UpdateRow = ({
  update,
  status,
}: {
  update: ActionUpdateDto;
  status: ActionUpdateStatus;
}) => (
  <tr className="border-t border-zinc-200">
    <td className="px-3 py-2">
      <Link
        to={href("/actions/:actionId/updates/:updateId", {
          actionId: String(update.actionId),
          updateId: String(update.id),
        })}
        className="font-medium text-blue-600 hover:underline"
      >
        {update.title || "Untitled update"}
      </Link>
    </td>
    <td className="px-3 py-2">
      <Link
        to={href("/actions/:actionId", { actionId: String(update.actionId) })}
        className="text-zinc-700 hover:underline"
      >
        {update.actionName ?? `Action #${update.actionId}`}
      </Link>
    </td>
    <td className="px-3 py-2 text-zinc-600">
      {formatDateTime(new Date(update.date))}
    </td>
    <td className="px-3 py-2">
      <span
        className={cn("rounded px-1.5 py-0.5 text-xs", STATUS_BADGE[status])}
      >
        {status === ActionUpdateStatus.Scheduled && update.visibleAt
          ? `Publishes ${formatDateTime(new Date(update.visibleAt))}`
          : ACTION_UPDATE_STATUS_LABELS[status]}
      </span>
    </td>
    <td className="px-3 py-2 text-zinc-600">
      {update.notifiedAt
        ? `Notified ${formatDateTime(new Date(update.notifiedAt))}`
        : "—"}
    </td>
  </tr>
);

const ActionUpdatesPage = () => {
  const list = useAllActionUpdatesAdmin();
  const groups = useMemo(() => {
    const now = new Date();
    const byStatus = new Map<ActionUpdateStatus, ActionUpdateDto[]>();
    for (const update of list.data ?? []) {
      const status = actionUpdateStatus(update, now);
      byStatus.set(status, [...(byStatus.get(status) ?? []), update]);
    }
    return STATUS_ORDER.flatMap((status) => {
      const updates = byStatus.get(status) ?? [];
      return updates.length ? [{ status, updates }] : [];
    });
  }, [list.data]);

  return (
    <div className="space-y-4 p-5">
      <title>Action Updates - Admin</title>
      <div>
        <h1 className="text-lg font-bold text-zinc-900">Action updates</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Every action&apos;s updates, including drafts and ones scheduled to
          publish later. Create updates from an action&apos;s Updates tab.
        </p>
      </div>
      {list.isPending ? (
        <p className="text-sm text-zinc-500">Loading updates…</p>
      ) : list.isError ? (
        <p role="alert" className="text-sm text-red-600">
          {adminRefusalMessage(list.error, "Couldn't load action updates.")}
        </p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-zinc-500">No action updates yet.</p>
      ) : (
        groups.map(({ status, updates }) => (
          <section key={status} className="space-y-2">
            <h2 className="text-sm font-semibold text-zinc-700">
              {ACTION_UPDATE_STATUS_LABELS[status]} ·{" "}
              {withCount(updates.length, "update")}
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full border border-zinc-200 bg-white text-sm">
                <thead className="bg-zinc-50 text-left text-xs text-zinc-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Title</th>
                    <th className="px-3 py-2 font-medium">Action</th>
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Notification</th>
                  </tr>
                </thead>
                <tbody>
                  {updates.map((update) => (
                    <UpdateRow
                      key={update.id}
                      update={update}
                      status={status}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}
    </div>
  );
};

export default ActionUpdatesPage;
