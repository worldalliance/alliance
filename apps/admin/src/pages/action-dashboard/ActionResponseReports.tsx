import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import { CardStyle } from "@alliance/shared/styles/card";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import React from "react";
import type { SetURLSearchParams } from "react-router";
import FormResponseStatistics from "../../components/FormResponseStatistics";
import type { FormResponseFilter } from "../../lib/responseFilter";
import type { ActionReporting } from "./useActionReporting";

type ActionResponseReportsProps = {
  action: ParsedActionDto;
  reporting: ActionReporting;
  hasMemberActionStarted: boolean;
  onTabChange: (tab: "responses") => void;
  setSearchParams: SetURLSearchParams;
};

const ActionResponseReports: React.FC<ActionResponseReportsProps> = ({
  action,
  reporting: { shareUrlStats, shareUrlStatsLoading, taskForm, formResponses },
  hasMemberActionStarted,
  onTabChange,
  setSearchParams,
}) => (
  <>
    {action.publicOnly && (
      <Card style={CardStyle.White}>
        <h2 className="font-semibold mb-4">
          Invite Stats (
          {shareUrlStats.reduce((sum, s) => sum + s.inviteCount, 0)} total
          public submissions)
        </h2>
        {shareUrlStatsLoading ? (
          <div className="text-sm text-gray-500">Loading...</div>
        ) : shareUrlStats.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-medium text-gray-600">
                    Member
                  </th>
                  <th className="text-right py-2 px-3 font-medium text-gray-600">
                    Form submissions
                  </th>
                  <th className="text-right py-2 px-3 font-medium text-gray-600">
                    Interested in joining
                  </th>
                </tr>
              </thead>
              <tbody>
                {shareUrlStats.map((stat) => (
                  <tr
                    key={stat.sid}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        <AvatarProfile
                          pfp={stat.user.profilePicture}
                          size="small"
                        />
                        <span className="font-medium text-gray-800">
                          {stat.user.displayName}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 px-3 text-right font-medium">
                      {stat.inviteCount}
                    </td>
                    <td className="py-2 px-3 text-right font-medium">
                      {stat.yesCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-sm text-gray-500">No invites yet.</div>
        )}
      </Card>
    )}

    {hasMemberActionStarted &&
      action.taskFormId &&
      taskForm &&
      formResponses.length > 0 && (
        <Card style={CardStyle.White}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              Response Statistics ({formResponses.length} responses)
            </h2>
            <Button
              onClick={() => onTabChange("responses")}
              color={ButtonColor.White}
              size="small"
            >
              View All Responses →
            </Button>
          </div>
          <FormResponseStatistics
            form={taskForm}
            responses={formResponses}
            onFilterSelect={(filter: FormResponseFilter) => {
              setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.set("tab", "responses");
                next.set("resp_tab", "replays");
                next.set("resp_filterField", filter.fieldId);
                next.set("resp_filterOp", filter.op);
                if (filter.value != null) {
                  next.set("resp_filterValue", filter.value);
                } else {
                  next.delete("resp_filterValue");
                }
                return next;
              });
            }}
          />
        </Card>
      )}
  </>
);

export default ActionResponseReports;
