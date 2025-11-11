import { ActionActivityDto, userListFriends } from "@alliance/shared/client";
import Button, { ButtonColor } from "@alliance/shared/ui/Button";
import { useCallback, useEffect, useRef, useState } from "react";
import UserActivityCard from "../../components/UserActivityCard";
import { useAuth } from "../../lib/AuthContext";
import useActivities, { ActivityList } from "./useActivities";
import CenterLayout from "@alliance/shared/ui/CenterLayout";
import { Link } from "react-router";

type Mode = "friends" | "everyone";

const ActivityFeedPage = () => {
  const modes: Mode[] = ["friends", "everyone"];
  const [mode, setMode] = useState<Mode>("friends");

  const { user } = useAuth();
  const { activities, handleLikeActivity, updateActivity, loading } =
    useActivities({
      list: ActivityList.Global,
    });

  const [myFriends, setMyFriends] = useState<number[]>([]);

  useEffect(() => {
    const loadMyFriends = async () => {
      if (!user) return;
      const friendsRes = await userListFriends({
        path: { id: user.id },
      });
      if (!friendsRes.data) return;
      setMyFriends(friendsRes.data.map((friend) => friend.id));
    };
    loadMyFriends();
  }, [user]);

  const [friendsActivities, setFriendsActivities] = useState<
    ActionActivityDto[]
  >([]);

  useEffect(() => {
    setFriendsActivities(
      activities.filter(
        (activity) =>
          activity.user.id === user?.id || myFriends.includes(activity.user.id)
      )
    );
  }, [activities, user, myFriends]);

  const friendsRef = useRef<HTMLDivElement>(null);
  const everyoneRef = useRef<HTMLDivElement>(null);
  const [activeHeight, setActiveHeight] = useState<number | undefined>(
    undefined
  );

  const updateHeight = useCallback(() => {
    const el = mode === "friends" ? friendsRef.current : everyoneRef.current;
    if (el) setActiveHeight(el.offsetHeight);
  }, [mode]);

  useEffect(() => {
    const roFriends = new ResizeObserver(updateHeight);
    const roEveryone = new ResizeObserver(updateHeight);
    if (friendsRef.current) roFriends.observe(friendsRef.current);
    if (everyoneRef.current) roEveryone.observe(everyoneRef.current);

    window.addEventListener("resize", updateHeight);
    requestAnimationFrame(updateHeight);

    return () => {
      roFriends.disconnect();
      roEveryone.disconnect();
      window.removeEventListener("resize", updateHeight);
    };
  }, [mode, updateHeight]);

  const renderActivityColumn = (mode: Mode) => {
    const list = mode === "friends" ? friendsActivities : activities;
    return (
      <div className="w-1/2">
        <div
          ref={mode === "friends" ? friendsRef : everyoneRef}
          className="flex flex-col divide-y divide-zinc-200 *:p-4"
        >
          {list.map((activity) => (
            <UserActivityCard
              activity={activity}
              key={activity.id}
              handleLike={handleLikeActivity}
              onActivityUpdate={updateActivity}
              canEdit={activity.user.id === user?.id}
            />
          ))}
          {list.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 text-zinc-500 p-8">
              <p>
                {loading
                  ? "Loading..."
                  : `No ${mode === "friends" ? "friend " : ""}activity yet`}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <CenterLayout width="3xl">
      <div className="mx-auto flex flex-row gap-x-2 mb-4 w-full justify-between items-center">
        <div className=" flex flex-row gap-x-2 justify-start">
          {modes.map((m) => (
            <Button
              color={ButtonColor.Transparent}
              key={m}
              onClick={() => setMode(m)}
              aria-pressed={m === mode}
              className={`!border-b-[2px] rounded-none ${
                m === mode
                  ? "!border-b-green text-black"
                  : "!border-b-transparent hover:!border-b-zinc-200 text-zinc-500"
              }`}
            >
              <p className="capitalize">{m}</p>
            </Button>
          ))}
        </div>
        <Link
          to="/members"
          className="text-zinc-800 hover:underline rounded text-sm font-medium"
        >
          Member list
        </Link>
      </div>

      <div
        className="relative overflow-hidden border border-zinc-200 rounded transition-[height] duration-100 ease-out bg-white"
        style={{
          height: activeHeight ?? "auto",
        }}
      >
        <div
          className="flex w-[200%] transition-transform duration-200 ease-out motion-reduce:transition-none"
          style={{
            transform:
              mode === "friends" ? "translateX(0%)" : "translateX(-50%)",
          }}
        >
          {renderActivityColumn("friends")}
          {renderActivityColumn("everyone")}
        </div>
      </div>
    </CenterLayout>
  );
};

export default ActivityFeedPage;
