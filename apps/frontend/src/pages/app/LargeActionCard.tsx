import { useCallback, useState } from "react";
import { useNavigate } from "react-router";

import { ActionDto, UserActionRelation } from "@alliance/shared/client";
import { ActionActivityDto } from "@alliance/shared/client/types.gen";
import Button, { ButtonColor } from "@alliance/shared/ui/Button";
import Card, { CardStyle } from "@alliance/shared/ui/Card";
import ActionTaskPanel from "../../components/ActionTaskPanel";
import CompletedBar from "../../components/CompletedBar";
import ClockIcon from "../../components/icons/ClockIcon";
import UserProfilePicRow from "../../components/UserProfilePicRow";
import { useActionCount } from "../../lib/useActionWebSocket";

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

  const liveUserCount = useActionCount(action.id);

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
      : action.usersJoined;

  const lastEvent = action.events[action.events.length - 1];

  return (
    <Card
      style={CardStyle.Outline}
      className={`transition-all duration-300 ${
        state === LargeActionCardState.Closed
          ? "opacity-0 overflow-hidden"
          : "opacity-100"
      } !border-1 !border-zinc-200 !p-6 w-full relative
         ${state === LargeActionCardState.Minified ? "pb-4" : ""}`}
    >
      <div className="p-2">
        <div className="flex flex-row items-start gap-x-8">
          <div className="flex-1 flex flex-col">
            <div className="flex flex-row items-start justify-between flex-wrap gap-x-4">
              <div className="">
                <div className="flex flex-row items-center gap-x-4 mb-2 justify-center">
                  {!!action.timeEstimate && (
                    <div className="flex flex-row items-center gap-x-1.5 text-base text-zinc-500">
                      <ClockIcon />
                      <p className="text-green">{`${
                        action.timeEstimate
                      } minute${action.timeEstimate === 1 ? "" : "s"}`}</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="w-24 flex flex-col gap-y-2">
                <Button
                  color={ButtonColor.Transparent}
                  onClick={goToActionPage}
                  className="w-full text-sm hover:bg-zinc-50 border border-zinc-200 text-black font-normal !rounded-none"
                >
                  Details
                </Button>
              </div>
            </div>
            <p className="font-medium font-serif text-2xl text-black">
              {action.name}
            </p>

            <p className="text-black mt-2">{action.shortDescription}</p>
            <div className="mt-4">
              <div className="flex flex-row items-center justify-between w-full gap-x-2">
                <p className="text-zinc-500 text-base mb-1">
                  {liveUserCount ?? 0} / {threshold}{" "}
                  {action.status === "gathering_commitments"
                    ? "committed"
                    : "completed"}
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
              <div className="w-full">
                <CompletedBar percentage={50} />
              </div>
            </div>

            {/* {action.type === "Funding" && <Badge>$5</Badge>}
          {action.type === "Activity" && !!action.timeEstimate && (
            <Badge>takes {action.timeEstimate}</Badge>
          )}
          {action.type === "Ongoing" && <Badge>3 week commitment</Badge>} */}
          </div>
        </div>

        <div className="mt-6 border-t pt-6 border-zinc-200">
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
