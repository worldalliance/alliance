import {
  UserActionRelationDetailDto,
  UserActionSummaryDto,
} from "@alliance/shared/client/types.gen";
import { cn } from "@alliance/shared/styles/util";
import { PILL_STATUS_DATA } from "@alliance/sharedweb/ui/UserProgressPills";
import { keyBy } from "es-toolkit";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import CreateActivityControls from "../CreateActivityControls";
import { WithdrawalInfo } from "../WithdrawalInfo";
import { humanize } from "./humanize";

export default function UserActionsSection({
  userId,
  actionSummaries,
  actionRelations,
}: {
  userId: number;
  actionSummaries: UserActionSummaryDto[];
  actionRelations: UserActionRelationDetailDto[];
}) {
  const [actionRelationsState, setActionRelationsState] =
    useState<UserActionRelationDetailDto[]>(actionRelations);

  useEffect(() => {
    setActionRelationsState(actionRelations);
  }, [actionRelations]);

  const navigate = useNavigate();

  const upsertActionRelation = useCallback(() => {
    navigate(window.location.pathname);
  }, [navigate]);

  const relationByActionId = useMemo(
    () => keyBy(actionRelationsState, (relation) => relation.actionId),
    [actionRelationsState],
  );

  return (
    <section className="max-h-128 overflow-y-auto">
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
                        actionId={action.id}
                        userId={userId}
                        onCreated={upsertActionRelation}
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
