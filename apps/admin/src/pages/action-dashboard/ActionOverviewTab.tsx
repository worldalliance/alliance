import {
  eventInEffectAt,
  hasMemberActionStarted,
} from "@alliance/common/actionEvent";
import { sortByDateDescending } from "@alliance/shared/lib/actionEventsPanel";
import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import { CardStyle } from "@alliance/shared/styles/card";
import { cn } from "@alliance/shared/styles/util";
import Card from "@alliance/sharedweb/ui/Card";
import React from "react";
import type { SetURLSearchParams } from "react-router";
import { FailedLoadsBanner } from "../../components/FailedLoadsBanner";
import type { ActionPhase } from "../../lib/actionPhase";
import PhaseHeader from "../project-action/PhaseHeader";
import ReleasePanel from "../project-action/ReleasePanel";
import ActionParticipationStats from "./ActionParticipationStats";
import ActionProjectRow from "./ActionProjectRow";
import ActionResponseReports from "./ActionResponseReports";
import type { ActionReporting } from "./useActionReporting";

type ActionOverviewTabProps = {
  action: ParsedActionDto;
  phase: ActionPhase;
  reporting: ActionReporting;
  /** Edits not yet saved anywhere on the page, which block staff testing and release changes. */
  unsaved: boolean;
  saving: boolean;
  onStaffPreviewChange: (staffPreview: boolean) => void;
  responsesHref: string;
  setSearchParams: SetURLSearchParams;
  incompleteUsersExpanded: boolean;
  setIncompleteUsersExpanded: (expanded: boolean) => void;
};

const ActionOverviewTab: React.FC<ActionOverviewTabProps> = ({
  action,
  phase,
  reporting,
  unsaved,
  saving,
  onStaffPreviewChange,
  responsesHref,
  setSearchParams,
  incompleteUsersExpanded,
  setIncompleteUsersExpanded,
}) => {
  const now = new Date();
  const currentEventId = eventInEffectAt(action.events, now).event?.id;
  const memberActionStarted = hasMemberActionStarted(action.events, now);

  return (
    <div className="space-y-4 pb-4">
      <PhaseHeader
        action={action}
        phase={phase}
        unsaved={unsaved}
        busy={saving}
        onStaffPreviewChange={onStaffPreviewChange}
      />
      <ReleasePanel action={action} phase={phase} disabled={unsaved} />
      <ActionProjectRow actionId={action.id} project={action.project ?? null} />
      <FailedLoadsBanner
        failed={reporting.failedLoads}
        consequence="The reports below are incomplete."
        className="rounded-md border"
      />
      {action.usersJoined > 0 && (
        <Card style={CardStyle.White}>
          <div className="flex justify-between text-sm mb-1">
            <span className="font-medium">Completion progress</span>
            <span className="text-zinc-600">
              {action.usersCompleted} / {action.usersJoined} (
              {Math.round(
                (action.usersCompleted / (action.usersJoined || 1)) * 100,
              )}
              %)
            </span>
          </div>
          <div className="w-full h-4 bg-zinc-100 rounded-full overflow-hidden">
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
        </Card>
      )}

      <ActionParticipationStats
        action={action}
        reporting={reporting}
        hasMemberActionStarted={memberActionStarted}
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
        hasMemberActionStarted={memberActionStarted}
        responsesHref={responsesHref}
        setSearchParams={setSearchParams}
      />
    </div>
  );
};

export default ActionOverviewTab;
