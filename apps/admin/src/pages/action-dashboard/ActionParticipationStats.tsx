import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import { CardStyle } from "@alliance/shared/styles/card";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import Card from "@alliance/sharedweb/ui/Card";
import {
  ChevronDown,
  ChevronUp,
  EyeOff,
  TrendingUp,
  UserCheck,
  UserMinus,
  Users,
  UserX,
} from "lucide-react";
import React from "react";
import ActionCompletionCurveChart from "../../components/ActionCompletionCurveChart";
import type { ActionReporting } from "./useActionReporting";

type ActionParticipationStatsProps = {
  action: ParsedActionDto;
  reporting: ActionReporting;
  hasMemberActionStarted: boolean;
  incompleteUsersExpanded: boolean;
  setIncompleteUsersExpanded: (expanded: boolean) => void;
};

const ActionParticipationStats: React.FC<ActionParticipationStatsProps> = ({
  action,
  reporting: { actionStats, incompleteUsers },
  hasMemberActionStarted,
  incompleteUsersExpanded,
  setIncompleteUsersExpanded,
}) => (
  <>
    {hasMemberActionStarted && (
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        <Card style={CardStyle.White} className="!p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <TrendingUp className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {action.usersJoined > 0
                  ? Math.round(
                      (action.usersCompleted / action.usersJoined) * 100,
                    )
                  : 0}
                %
              </p>
              <p className="text-xs text-gray-500">Completion Rate</p>
            </div>
          </div>
        </Card>
        <Card style={CardStyle.White} className="!p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{action.usersJoined}</p>
              <p className="text-xs text-gray-500">
                {action.optional ? "Able to complete" : "Expected to complete"}
              </p>
            </div>
          </div>
        </Card>
        <Card style={CardStyle.White} className="!p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <UserCheck className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{action.usersCompleted}</p>
              <p className="text-xs text-gray-500">Completed</p>
            </div>
          </div>
        </Card>
        <Card style={CardStyle.White} className="!p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <UserMinus className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {actionStats?.usersWithdrawn ?? 0}
              </p>
              <p className="text-xs text-gray-500">Withdrawn</p>
            </div>
          </div>
        </Card>
        {incompleteUsers.length > 0 && !action.optional && (
          <Card
            style={CardStyle.White}
            className="!p-4 cursor-pointer hover:bg-gray-50"
            onClick={() => setIncompleteUsersExpanded(!incompleteUsersExpanded)}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <UserX className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{incompleteUsers.length}</p>
                <p className="text-xs text-gray-500">Failed to Complete</p>
              </div>
              {incompleteUsersExpanded ? (
                <ChevronUp className="h-4 w-4 text-gray-400 ml-auto" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-400 ml-auto" />
              )}
            </div>
          </Card>
        )}
        {action.optional && (
          <Card style={CardStyle.White} className="!p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <EyeOff className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {actionStats?.usersDismissed ?? 0}
                </p>
                <p className="text-xs text-gray-500">Dismissed</p>
              </div>
            </div>
          </Card>
        )}
      </div>
    )}

    {incompleteUsersExpanded && incompleteUsers.length > 0 && (
      <Card style={CardStyle.White}>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Users Who Failed to Complete
        </h3>
        <ul className="divide-y divide-gray-200 max-h-64 overflow-y-auto">
          {incompleteUsers.map((user) => (
            <li key={user.id} className="py-2">
              <a
                href={`/users/${user.id}`}
                className="flex items-center gap-2 hover:bg-gray-50 px-2 py-1 rounded"
              >
                <AvatarProfile pfp={user.profilePicture} size="small" />
                <span className="text-sm font-medium text-gray-800 hover:text-blue-600">
                  {user.displayName}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </Card>
    )}
    {hasMemberActionStarted && !action.publicOnly && !action.optional && (
      <ActionCompletionCurveChart
        title="Completion over time"
        actionId={action.id}
        showSelector={false}
      />
    )}
  </>
);

export default ActionParticipationStats;
