import React, { useCallback } from "react";
import Card, { CardStyle } from "./system/Card";
import { useNavigate } from "react-router";
import { ActionDto } from "@alliance/shared/client/types.gen";
import ActionCardUserCount from "./ActionCardUserCount";
import Button, { ButtonColor } from "./system/Button";

export interface ActionItemCardProps
  extends Pick<ActionDto, "name" | "shortDescription" | "category" | "id"> {
  className?: string;
  joinedCount?: number;
  completedCount?: number;
  showDescription?: boolean;
}

const ActionItemCard: React.FC<ActionItemCardProps> = ({
  name,
  id,
  shortDescription,
  className,
  joinedCount,
  completedCount,
  showDescription = true,
}) => {
  const navigate = useNavigate();

  const goToActionPage = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      navigate(`/actions/${id}`);
    },
    [navigate, id]
  );

  return (
    <div className={`relative ${className}`}>
      <Card className="block shadow" style={CardStyle.White}>
        <div className="flex flex-row items-start gap-x-8">
          <div className="flex-1 flex flex-col">
            <p className="font-medium text-black">{name}</p>
            <p className="text-zinc-400">{shortDescription}</p>
          </div>
          <div>
            <div className="w-24 flex flex-col gap-y-2">
              <Button
                color={ButtonColor.Transparent}
                onClick={goToActionPage}
                className="w-full text-sm rounded-md text-white font-medium bg-blue-500 hover:bg-blue-600 font-regular"
              >
                Commit
              </Button>
              <Button
                color={ButtonColor.Transparent}
                onClick={goToActionPage}
                className="w-full text-sm rounded-md hover:bg-zinc-50 border border-zinc-200 text-black font-regular"
              >
                Details
              </Button>
            </div>
          </div>
        </div>

        {/* <div className="flex flex-row items-start gap-x-8">
          <div className="w-[100%] space-x-3">
            <div className="flex flex-row justify-between items-start mr-0">
              {joinedCount !== undefined && (
                <ActionCardUserCount
                  joined={joinedCount}
                  completed={completedCount}
                />
              )}
            </div>
          </div>
        </div> */}
      </Card>
    </div>
  );
};

export default ActionItemCard;
