import { User } from "@alliance/shared/client";
import { getApiUrl } from "@alliance/shared/lib/config";
import Card, { CardStyle } from "@alliance/shared/ui/Card";
import ProfileImage from "@alliance/shared/ui/ProfileImage";
import { Duration, formatDuration, intervalToDuration } from "date-fns";
import { useNavigate } from "react-router";

const UserCard = ({
  user,
  timeSpent,
  timeSpentTotal,
}: {
  user: User;
  timeSpent: number;
  timeSpentTotal: number;
}) => {
  const navigate = useNavigate();

  const formatTime = (time: number) => {
    const interval = intervalToDuration({ start: 0, end: time * 1000 });
    const formatUnits: (keyof Duration)[] =
      interval.minutes || interval.hours || interval.days
        ? ["hours", "minutes"]
        : ["hours", "minutes", "seconds"];
    return formatDuration(interval, {
      format: formatUnits,
    })
      .replace(" hours", "h")
      .replace(" minutes", "m")
      .replace(" seconds", "s");
  };

  const time = formatTime(timeSpent);
  const timeTotal = formatTime(timeSpentTotal);

  const contractStatusColor = user.contractDateSuspended
    ? "text-red-500"
    : user.contractDateSigned
    ? "text-green"
    : "text-zinc-500";

  const contractStatus = user.contractDateSuspended
    ? "Suspended"
    : user.contractDateSigned
    ? "Signed"
    : "Not signed";

  return (
    <Card
      style={CardStyle.White}
      className="min-w-[300px] text-sm"
      onClick={() => navigate(`/database/?table=user&id=${user.id}`)}
    >
      <div className="flex flex-row items-center gap-x-3 border-b pb-2 mb-2 border-zinc-200">
        <ProfileImage
          pfp={
            user.profilePicture
              ? getApiUrl() + "/images/" + user.profilePicture
              : null
          }
          size="large"
        />
        <p className="text-base">{user.name}</p>
      </div>
      <div className="flex flex-row items-center border-b pb-2 mb-2 border-zinc-200">
        <p>
          Contract status:{" "}
          <span className={`font-medium ${contractStatusColor}`}>
            {contractStatus}
          </span>
        </p>
      </div>
      <div>
        <p className="font-semibold ">Activity</p>
        <div className="flex flex-row justify-between ">
          <p className="text-zinc-500">Last 7 days</p>
          <p className={`${!time && "text-zinc-500"}`}>{time || "0"}</p>
        </div>
        <div className="flex flex-row justify-between ">
          <p className="text-zinc-500">Total</p>
          <p className={`${!timeTotal && "text-zinc-500"}`}>
            {timeTotal || "0"}
          </p>
        </div>
      </div>
    </Card>
  );
};

export default UserCard;
