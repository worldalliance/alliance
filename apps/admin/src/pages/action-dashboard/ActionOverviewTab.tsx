import { sortByDateDescending } from "@alliance/shared/lib/actionEventsPanel";
import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import { CardStyle } from "@alliance/shared/styles/card";
import { cn } from "@alliance/shared/styles/util";
import Card from "@alliance/sharedweb/ui/Card";
import React from "react";
import type { SetURLSearchParams } from "react-router";
import { ActionProjectSteps } from "../../components/ActionProjectControls";
import {
  ACTION_STATUS_COLORS,
  ACTION_STATUS_LABELS,
} from "../../lib/actionStatusDisplay";
import ActionDashboardToolbar from "./ActionDashboardToolbar";
import {
  currentEventIdAt,
  hasMemberActionStartedAt,
} from "./actionEventTiming";
import ActionParticipationStats from "./ActionParticipationStats";
import ActionResponseReports from "./ActionResponseReports";
import type { ActionExport } from "./useActionExport";
import type { ActionReporting } from "./useActionReporting";

type ActionOverviewTabProps = {
  action: ParsedActionDto;
  reporting: ActionReporting;
  actionExport: ActionExport;
  imageUploading: boolean;
  onDuplicate: () => Promise<void>;
  onArchive: () => Promise<void>;
  onTabChange: (tab: "events" | "responses") => void;
  setSearchParams: SetURLSearchParams;
  incompleteUsersExpanded: boolean;
  setIncompleteUsersExpanded: (expanded: boolean) => void;
};

const ActionOverviewTab: React.FC<ActionOverviewTabProps> = ({
  action,
  reporting,
  actionExport,
  imageUploading,
  onDuplicate,
  onArchive,
  onTabChange,
  setSearchParams,
  incompleteUsersExpanded,
  setIncompleteUsersExpanded,
}) => {
  const now = new Date();
  const currentEventId = currentEventIdAt(action.events, now);
  const hasMemberActionStarted = hasMemberActionStartedAt(action.events, now);

  return (
    <div className="space-y-4 pb-4">
      <ActionDashboardToolbar
        action={action}
        actionExport={actionExport}
        imageUploading={imageUploading}
        onDuplicate={onDuplicate}
        onArchive={onArchive}
      />
      {action.project && (
        <ActionProjectSteps
          actionId={action.id}
          projectId={action.project.id}
        />
      )}
      <Card style={CardStyle.White}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">Status</h2>
            <span
              className={cn(
                "inline-flex items-center px-3 py-1 rounded-full cursor-pointer text-sm font-medium",
                ACTION_STATUS_COLORS[action.status],
              )}
              onClick={() => onTabChange("events")}
            >
              {ACTION_STATUS_LABELS[action.status]}
            </span>
          </div>
        </div>

        {action.usersJoined > 0 && (
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium">Completion Progress</span>
              <span className="text-gray-600">
                {action.usersCompleted} / {action.usersJoined} (
                {Math.round(
                  (action.usersCompleted / (action.usersJoined || 1)) * 100,
                )}
                %)
              </span>
            </div>
            <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-green rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(
                    (action.usersCompleted / (action.usersJoined || 1)) * 100,
                    100,
                  )}%`,
                }}
              />
            </div>
          </div>
        )}
      </Card>

      <ActionParticipationStats
        action={action}
        reporting={reporting}
        hasMemberActionStarted={hasMemberActionStarted}
        incompleteUsersExpanded={incompleteUsersExpanded}
        setIncompleteUsersExpanded={setIncompleteUsersExpanded}
      />
      <Card style={CardStyle.White}>
        <h2 className="text-lg font-semibold mb-3">Timeline</h2>
        <div className="space-y-2">
          {action.events.length > 0 ? (
            sortByDateDescending(action.events).map((event) => (
              <div
                key={event.id}
                className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0"
              >
                <div
                  className={cn(
                    "w-2 h-2 rounded-full flex-shrink-0",
                    event.id === currentEventId ? "bg-blue-500" : "bg-gray-300",
                  )}
                />
                <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="">{event.title}</span>
                  </div>
                  <span className="text-xs text-gray-500 flex-shrink-0">
                    {new Date(event.date).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="text-sm text-gray-500">
              No events yet. This action is in Draft status by default.
            </div>
          )}
        </div>
      </Card>

      <ActionResponseReports
        action={action}
        reporting={reporting}
        hasMemberActionStarted={hasMemberActionStarted}
        onTabChange={onTabChange}
        setSearchParams={setSearchParams}
      />
    </div>
  );
};

export default ActionOverviewTab;
