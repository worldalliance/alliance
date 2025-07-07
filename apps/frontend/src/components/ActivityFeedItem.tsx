import { ActionActivityDto } from "@alliance/shared/client";
import Card, { CardStyle } from "./system/Card";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router";
export interface ActivityFeedItemProps {
  activity: FeedActivity;
}

export interface FeedActivity extends ActionActivityDto {
  actionId: number;
  actionName?: string;
}

const ActivityFeedItem = ({ activity }: ActivityFeedItemProps) => {
  const navigate = useNavigate();
  const verb = activity.type === "user_joined" ? "joined" : "completed";
  return (
    <div className="flex flex-row items-center gap-x-4 w-full">
      <Card
        style={CardStyle.White}
        className="flex-1 flex-row justify-between"
        onClick={() => {
          navigate(`/actions/${activity.actionId}`);
        }}
      >
        <p className="text-black">
          {`${activity.user.displayName}`}
          <span className="text-gray-600"> {verb}</span>
          <span className="font-semibold"> {activity.actionName}</span>
        </p>
        <p className="text-gray-500 text-right">
          {formatDistanceToNow(new Date(activity.createdAt), {
            addSuffix: true,
          })}{" "}
        </p>
      </Card>
    </div>
  );
};

export default ActivityFeedItem;
