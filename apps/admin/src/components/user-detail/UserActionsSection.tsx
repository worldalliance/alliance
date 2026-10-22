import { cn } from "@alliance/shared/styles/util";
import { PILL_STATUS_DATA } from "@alliance/sharedweb/ui/UserProgressPills";
import { keyBy } from "es-toolkit";
import { useMemo } from "react";
import { Link } from "react-router";
import { useUserActionRelationsAdmin } from "../../lib/useUserActionRelationsAdmin";
import CreateActivityControls from "../CreateActivityControls";
import { WithdrawalInfo } from "../WithdrawalInfo";
import { humanize } from "./humanize";

export default function UserActionsSection({ userId }: { userId: number }) {
  const {
    query: { data, isError, isRefetchError },
    createActivity: { mutateAsync: createActivity },
  } = useUserActionRelationsAdmin(userId);

  const relationByActionId = useMemo(
    () => keyBy(data?.actionRelations ?? [], (relation) => relation.actionId),
    [data?.actionRelations],
  );

  if (!data) {
    return (
      <p className={cn("text-sm", isError ? "text-red-500" : "text-zinc-500")}>
        {isError ? "Failed to load actions" : "Loading actions..."}
      </p>
    );
  }
  const { actionSummaries } = data;

  return (
    <section className="max-h-128 overflow-y-auto">
      {isRefetchError && (
        <p className="text-xs text-red-500 mb-2">
          Could not refresh actions. Reload to see the latest.
        </p>
      )}
      {actionSummaries.length ? (
        <div className="border border-zinc-200 rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-100 text-left">
              <tr>
                <th className="px-3 py-2 font-medium text-zinc-600">Action</th>
                <th className="px-3 py-2 font-medium text-zinc-600">Status</th>
                <th className="px-3 py-2 font-medium text-zinc-600 text-nowrap">
                  User Status
                </th>
                <th className="px-3 py-2 font-medium text-zinc-600 text-nowrap">
                  Last Activity
                </th>
                <th className="px-3 py-2 font-medium text-zinc-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {actionSummaries.map((action) => {
                const relation = relationByActionId[action.id];
                const { pillLabel, pillTextStyle } =
                  PILL_STATUS_DATA[relation.status];
                return (
                  <tr key={action.id} className="hover:bg-zinc-50">
                    <td className="px-3 py-2">
                      <Link
                        to={`/actions/${action.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {action.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-zinc-500">
                      {humanize(action.status)}
                    </td>
                    <td className="px-3 py-2">
                      {relation.status === "wont_complete" ? (
                        <WithdrawalInfo
                          withdrawal={relation}
                          trigger={
                            <span
                              className={cn(
                                "font-medium cursor-default",
                                pillTextStyle,
                              )}
                            >
                              {pillLabel}
                            </span>
                          }
                        />
                      ) : (
                        <span className={cn("font-medium", pillTextStyle)}>
                          {pillLabel}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-zinc-500">
                      {relation.latestActivityAt
                        ? new Date(
                            relation.latestActivityAt,
                          ).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <CreateActivityControls
                        create={(type) =>
                          createActivity({ actionId: action.id, type })
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-zinc-500">No actions tracked.</p>
      )}
    </section>
  );
}
