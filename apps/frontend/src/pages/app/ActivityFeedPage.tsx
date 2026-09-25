import useActivities, {
  ActivityList,
} from "@alliance/shared/lib/useActivities";
import { cn } from "@alliance/shared/styles/util";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import CenterLayout from "@alliance/sharedweb/ui/CenterLayout";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, href } from "react-router";
import UserActivityCard from "../../components/UserActivityCard";
import { useInfiniteScrollSentinel } from "../../hooks/useInfiniteScrollSentinel";

type Mode = "friends" | "everyone";

const ActivityFeedPage = () => {
  const modes: Mode[] = ["friends", "everyone"];
  const [mode, setMode] = useState<Mode>("friends");

  const {
    activities,
    handleLikeActivity: handleGlobalLikeActivity,
    loading,
    fetchNextPage: fetchNextGlobal,
    hasNextPage: hasNextGlobal,
    isFetchingNextPage: isFetchingNextGlobal,
  } = useActivities({
    list: ActivityList.Global,
    comments: true,
    limit: 30,
  });

  const {
    activities: friendActivities,
    handleLikeActivity: handleLikeFriendActivity,
    loading: loadingFriend,
    fetchNextPage: fetchNextFriends,
    hasNextPage: hasNextFriends,
    isFetchingNextPage: isFetchingNextFriends,
  } = useActivities({
    list: ActivityList.Friends,
    comments: true,
    limit: 30,
  });

  const handleLikeActivity = useCallback(
    (activityId: number, mode: Mode) => {
      if (mode === "friends") {
        return handleLikeFriendActivity(activityId);
      } else {
        return handleGlobalLikeActivity(activityId);
      }
    },
    [handleLikeFriendActivity, handleGlobalLikeActivity],
  );

  const friendsRef = useRef<HTMLDivElement>(null);
  const everyoneRef = useRef<HTMLDivElement>(null);
  const friendsSentinelRef = useInfiniteScrollSentinel({
    fetchNextPage: fetchNextFriends,
    hasNextPage: hasNextFriends,
    isFetchingNextPage: isFetchingNextFriends,
  });
  const everyoneSentinelRef = useInfiniteScrollSentinel({
    fetchNextPage: fetchNextGlobal,
    hasNextPage: hasNextGlobal,
    isFetchingNextPage: isFetchingNextGlobal,
  });

  const [activeHeight, setActiveHeight] = useState<number | undefined>(
    undefined,
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
    const list = mode === "friends" ? friendActivities : activities;
    const isFetchingNext =
      mode === "friends" ? isFetchingNextFriends : isFetchingNextGlobal;
    const sentinelRef =
      mode === "friends" ? friendsSentinelRef : everyoneSentinelRef;
    return (
      <div className="w-1/2">
        <div
          ref={mode === "friends" ? friendsRef : everyoneRef}
          className="flex flex-col bg-page"
        >
          <div className="flex flex-col gap-y-2 *:p-4">
            {list.map((activity) => (
              <UserActivityCard
                activity={activity}
                key={activity.id}
                handleLike={() => handleLikeActivity(activity.id, mode)}
              />
            ))}
            {list.length === 0 && (
              <div className="flex flex-col items-center justify-center h-64 text-zinc-500 p-8">
                <p>
                  {(mode === "friends" ? loadingFriend : loading)
                    ? "Loading..."
                    : `No ${mode === "friends" ? "friend " : ""}activity yet`}
                </p>
              </div>
            )}
          </div>
          {isFetchingNext && (
            <div className="flex justify-center py-4 text-zinc-400">
              Loading more...
            </div>
          )}
          <div ref={sentinelRef} className="h-1" />
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
              className={cn(
                "!border-b-[2px] rounded-none",
                m === mode
                  ? "border-b-green! text-black"
                  : "border-b-transparent! hover:border-b-zinc-200! text-zinc-500",
              )}
            >
              <p className="capitalize text-base">{m}</p>
            </Button>
          ))}
        </div>
        <Link
          to={href("/members")}
          className="text-zinc-800 hover:underline rounded font-medium"
        >
          Member list
        </Link>
      </div>

      <div
        className="relative overflow-hidden bg-white"
        style={{ height: activeHeight }}
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
