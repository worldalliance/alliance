import { ActionStatsWithOnboardingDto } from "@alliance/shared/client/types.gen";
import React from "react";
import Section from "../ui/Section";

const th = "px-3 py-2 text-left font-medium";

const rateClass = (rate: number) =>
  rate >= 0.9
    ? "font-medium text-green-700"
    : rate >= 0.7
      ? "text-amber-700"
      : "text-red-700";

const ActionStatsTable: React.FC<{
  actionStats: ActionStatsWithOnboardingDto[];
}> = ({ actionStats }) =>
  actionStats.length === 0 ? null : (
    <Section title="Action stats" meta={`${actionStats.length} actions`}>
      <div
        role="region"
        aria-label="Action stats table"
        tabIndex={0}
        className="max-h-96 overflow-auto outline-hidden focus-visible:ring-2 focus-visible:ring-blue-600"
      >
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="sticky top-0 bg-zinc-50 text-zinc-600">
            <tr>
              <th className={th}>Action</th>
              <th className={th}>Completed</th>
              <th className={th}>Joined</th>
              <th className={th}>Completion rate</th>
              <th className={th}>Action date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {actionStats.map((action) => (
              <tr key={action.actionId}>
                <td className="px-3 py-2 font-medium text-zinc-900">
                  {action.actionName}
                </td>
                <td className="px-3 py-2 tabular-nums">
                  {action.usersCompleted}
                </td>
                <td className="px-3 py-2 tabular-nums">{action.usersJoined}</td>
                <td className="px-3 py-2 tabular-nums">
                  {action.usersJoined > 0 ? (
                    <span className={rateClass(action.completionRate)}>
                      {Math.round(action.completionRate * 100)}%
                    </span>
                  ) : (
                    <span className="text-zinc-500">N/A</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-zinc-600">
                  {action.memberActionStartDate
                    ? new Date(
                        action.memberActionStartDate,
                      ).toLocaleDateString()
                    : "N/A"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );

export default ActionStatsTable;
