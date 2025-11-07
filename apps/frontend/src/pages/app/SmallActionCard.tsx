import { ActionActivityDto } from "@alliance/shared/client/types.gen";
import Card, { CardStyle } from "@alliance/shared/ui/Card";
import React, { useCallback } from "react";
import { useNavigate } from "react-router";
import { ActionWithRelation } from "../../applayout";
import Tag, { TagStyle } from "../../components/Tag";
import ActionCompletedBarWithInfo from "./ActionCompletedBarWithInfo";

export interface SmallActionCardProps {
  action: Pick<
    ActionWithRelation,
    | "name"
    | "shortDescription"
    | "commitmentless"
    | "category"
    | "id"
    | "status"
    | "everyoneShouldComplete"
    | "relation"
    | "commitmentThreshold"
    | "status"
    | "everyoneShouldComplete"
    | "usersCompleted"
    | "usersJoined"
  >;
  className?: string;
  friendActivities?: ActionActivityDto[];
  showDescription?: boolean;
}

const SmallActionCard: React.FC<SmallActionCardProps> = ({
  action,
  className,
  friendActivities = [],
}) => {
  const navigate = useNavigate();

  const goToActionPage = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      navigate(`/actions/${action.id}`);
    },
    [navigate, action.id]
  );

  const waitingOnCompletion =
    action.status === "member_action" &&
    (action.relation === "joined" || action.commitmentless);

  const waitingOnCommitment =
    action.status === "gathering_commitments" && action.relation === "none";

  const waitingForOffice =
    action.status === "office_action" && action.relation === "joined";

  const waitingOnOthers =
    action.status === "gathering_commitments" && action.relation === "joined";

  return (
    <div className={`relative ${className}`}>
      <Card
        className="block overflow-hidden hover:bg-zinc-50"
        style={CardStyle.White}
        onClick={goToActionPage}
      >
        <div className="flex flex-row items-start gap-x-8">
          <div className="flex-1 flex flex-col">
            <div className="self-start *:mb-2">
              {waitingOnCompletion && (
                <Tag style={TagStyle.GreyOutline}>Needs your completion</Tag>
              )}
              {waitingOnCommitment && (
                <Tag style={TagStyle.GreyOutline}>Gathering commitments</Tag>
              )}
              {waitingForOffice && (
                <Tag style={TagStyle.GreyOutline}>Pending office action</Tag>
              )}
              {waitingOnOthers && (
                <Tag style={TagStyle.GreyOutline}>
                  Waiting for commitments from others
                </Tag>
              )}
            </div>

            <p className="font-medium text-black">{action.name}</p>
            <p className="text-zinc-500">{action.shortDescription}</p>
          </div>
        </div>
        <ActionCompletedBarWithInfo
          action={action}
          friendActivities={friendActivities}
          className="mt-4"
        />
      </Card>
    </div>
  );
};

export default SmallActionCard;
