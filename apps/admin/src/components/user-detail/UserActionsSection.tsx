import { cn } from "@alliance/shared/styles/util";
import { PILL_STATUS_DATA } from "@alliance/sharedweb/ui/UserProgressPills";
import { keyBy } from "es-toolkit";
import { useMemo } from "react";
import { Link } from "react-router";
import { useUserActionRelationsAdmin } from "../../lib/useUserActionRelationsAdmin";
import CreateActivityControls from "../CreateActivityControls";
import Section from "../ui/Section";
import { WithdrawalInfo } from "../WithdrawalInfo";
import { humanize } from "./humanize";
import { SectionLoadState, SectionRefreshError } from "./SectionQueryState";

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
      <Section title="Actions">
        <SectionLoadState noun="actions" isError={isError} />
      </Section>
    );
  }
  const { actionSummaries } = data;

  return (
    <Section title="Actions" meta={actionSummaries.length}>
      <SectionRefreshError noun="actions" isError={isRefetchError} />
      {actionSummaries.length ? (
        <div className="max-h-128 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-100 text-left">
              <tr>
                <th className="px-3 py-2 font-medium text-zinc-600">Action</th>
                <th className="px-3 py-2 font-medium text-zinc-600">Status</th>
                <th className="px-3 py-2 font-medium text-zinc-600 text-nowrap">
                  Member status
                </th>
                <th className="px-3 py-2 font-medium text-zinc-600 text-nowrap">
                  Last activity
                </th>
                <th className="px-3 py-2 font-medium text-zinc-600">
                  Record activity
                </th>
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
    </Section>
  );
}
