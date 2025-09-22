import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";

import {
  ActionDto,
  UserActionRelation,
  userCount,
} from "@alliance/shared/client";
import { ActionActivityDto } from "@alliance/shared/client/types.gen";
import Button, { ButtonColor } from "@alliance/shared/ui/Button";
import Card, { CardStyle } from "@alliance/shared/ui/Card";
import ClockIcon from "@alliance/shared/ui/icons/ClockIcon";
import DeadlineIcon from "@alliance/shared/ui/icons/DeadlineIcon";
import ActionTaskPanel from "../../components/ActionTaskPanel";
import CompletedBar from "../../components/CompletedBar";
import UserProfilePicRow from "../../components/UserProfilePicRow";
import { useActionCount } from "../../lib/useActionWebSocket";
import { formatTime } from "../../lib/utils";

export interface LargeActionCardProps {
  action: ActionDto;
  userRelation: Extract<UserActionRelation, "joined" | "none">;
  friendActivities: ActionActivityDto[];
  onUpdateActionState: () => void;
}

enum LargeActionCardState {
  Minified = "minified",
  Default = "default",
  Confirming = "confirming",
  Completed = "completed",
  Committed = "committed",
  Closed = "closed",
  Declined = "declined",
}

const LargeActionCard: React.FC<LargeActionCardProps> = ({
  action,
  userRelation,
  friendActivities = [],
  onUpdateActionState,
}: LargeActionCardProps) => {
  const navigate = useNavigate();

  const [state, setState] = useState<LargeActionCardState>(
    LargeActionCardState.Default
  );

  useEffect(() => {
    setState(LargeActionCardState.Default);
  }, [action]);

  const liveUserCount = useActionCount(action.id);

  const [members, setMembers] = useState(30);
  useEffect(() => {
    userCount().then((count) => {
      setMembers(count.data ?? 30);
    });
  }, []);

  const handleUpdateActionState = useCallback(() => {
    setState(LargeActionCardState.Closed);
    setTimeout(() => {
      onUpdateActionState();
    }, 200);
  }, [onUpdateActionState]);

  const goToActionPage = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      navigate(`/actions/${action.id}`);
    },
    [navigate, action]
  );

  const threshold =
    action.status === "gathering_commitments"
      ? action.commitmentThreshold ?? 10
      : action.commitmentless
      ? members
      : action.usersJoined;

  const pastEvents = action.events.filter(
    (event) => new Date(event.date) <= new Date()
  );

  const futureEvents = action.events.filter(
    (event) => new Date(event.date) > new Date()
  );

  const lastEvent = pastEvents[pastEvents.length - 1];
  const nextEvent = futureEvents.length > 0 ? futureEvents[0] : null;

  const deadlineColor =
    !!nextEvent && new Date(nextEvent.date).getTime() - Date.now() < 172800000 // 2 days
      ? "var(--color-red-600)"
      : "var(--color-zinc-500)";

  return (
    <Card
      style={CardStyle.White}
      className={`transition-all duration-300 ${
        state === LargeActionCardState.Closed
          ? "opacity-0 overflow-hidden"
          : "opacity-100"
      } w-full relative p-6
         ${state === LargeActionCardState.Minified ? "pb-4" : ""}`}
    >
      <div className="p-0 sm:p-2">
        <div className="flex flex-col sm:flex-row gap-x-2 items-start mb-1">
          <Button
            color={ButtonColor.Transparent}
            onClick={goToActionPage}
            className="!px-6 block mb-4 sm:hidden text-sm hover:bg-zinc-50 border border-zinc-200 text-black font-normal"
          >
            Details
          </Button>
          <div className="flex flex-col flex-1">
            <div className="flex flex-row flex-wrap gap-x-4 mb-2">
              {!!action.timeEstimate &&
                action.status !== "gathering_commitments" && (
                  <div className="flex flex-row items-center gap-x-1.5 text-base text-zinc-500">
                    <ClockIcon />
                    <p className="text-green">{`${action.timeEstimate} minute${
                      action.timeEstimate === 1 ? "" : "s"
                    }`}</p>
                  </div>
                )}
              {!!nextEvent && (
                <div className="flex flex-row items-center gap-x-1.5 text-base text-zinc-500">
                  <DeadlineIcon fill={deadlineColor} />
                  <p style={{ color: deadlineColor }}>
                    {`${formatTime(new Date(nextEvent.date), {
                      addSuffix: false,
                    })}`}{" "}
                    left
                  </p>
                </div>
              )}
              {!nextEvent && (
                <p className="text-base text-zinc-500">
                  {action.status === "gathering_commitments"
                    ? "Entered commitment stage "
                    : "Entered action stage "}
                  {formatTime(new Date(lastEvent.date), { addSuffix: true })}
                </p>
              )}
            </div>
            <p className="font-medium text-lg">{action.name}</p>
          </div>
          <Button
            color={ButtonColor.Transparent}
            onClick={goToActionPage}
            className="!px-6 hidden sm:block text-sm hover:bg-zinc-50 border border-zinc-200 text-black font-normal"
          >
            Details
          </Button>
        </div>
        <p>{action.shortDescription}</p>

        {
          <div className="mt-6">
            {!action.commitmentless && (
              <div>
                <div className="flex flex-row items-center justify-between w-full gap-x-2">
                  <p className="text-zinc-500 text-sm mb-1">
                    {liveUserCount ?? action.usersCompleted} / {threshold}{" "}
                    {action.status === "gathering_commitments"
                      ? "members committed"
                      : "members completed"}
                    {friendActivities.length > 0 && (
                      <>
                        , including {friendActivities.length} friend
                        {friendActivities.length === 1 ? "" : "s"}
                      </>
                    )}
                  </p>
                  <UserProfilePicRow
                    users={friendActivities.map((activity) => activity.user)}
                  />
                </div>
                <CompletedBar
                  percentage={
                    ((liveUserCount ?? action.usersCompleted) / threshold) * 100
                  }
                />
              </div>
            )}
          </div>
        }
        <div className="mt-6 border-t border-zinc-200 pt-6">
          <ActionTaskPanel
            action={action}
            userRelation={userRelation}
            onCompleteAction={handleUpdateActionState}
            onJoinAction={handleUpdateActionState}
            onDeclineAction={handleUpdateActionState}
            onOptOutAction={handleUpdateActionState}
          />
        </div>
      </div>
    </Card>
  );
};

export default LargeActionCard;
