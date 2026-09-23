import { ActionDto, actionsFindOne } from "@alliance/shared/client";
import useActivities, {
  ActivityList,
} from "@alliance/shared/lib/useActivities";
import {
  selectFriendIds,
  useUserFriendsQuery,
} from "@alliance/shared/lib/user";
import { cn } from "@alliance/shared/styles/util";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import CenterLayout from "@alliance/sharedweb/ui/CenterLayout";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, href, useParams } from "react-router";
import chevronLeft from "../../assets/icons8-expand-arrow-96.png";
import UserActivityCard from "../../components/UserActivityCard";
import { useAuth } from "../../lib/AuthContext";

type Mode = "friends" | "everyone";

const ActionActivityFeedPage = () => {
  const { actionId } = useParams<{ actionId: string }>();

  const { isAuthenticated, user } = useAuth();

  const [action, setAction] = useState<ActionDto | null>(null);
  const [actionLoading, setActionLoading] = useState(true);

  const fetchAction = useCallback(async () => {
    try {
      setActionLoading(true);
      const actionResponse = await actionsFindOne({
        path: { id: parseInt(actionId!) },
      });
      console.log("Fetched action:", actionResponse);
      if (actionResponse.data) {
        setAction(actionResponse.data);
      } else {
        setAction(null);
      }
    } finally {
      setActionLoading(false);
    }
  }, [actionId]);

  useEffect(() => {
    fetchAction();
  }, [fetchAction, isAuthenticated]);

  const modes: Mode[] = ["friends", "everyone"];
  const [mode, setMode] = useState<Mode>("friends");

  const {
    activities,
    handleLikeActivity,
    loading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useActivities({
    list: ActivityList.Action,
    objectId: parseInt(actionId!),
    comments: true,
    limit: 50,
  });

  const { data: myFriends = [] } = useUserFriendsQuery(user?.id, {
    select: selectFriendIds,
  });

  const friendsActivities = useMemo(
    () =>
      activities.filter(
        (activity) =>
          activity.user.id === user?.id || myFriends.includes(activity.user.id),
      ),
    [activities, user, myFriends],
  );

  const friendsRef = useRef<HTMLDivElement>(null);
  const everyoneRef = useRef<HTMLDivElement>(null);
  const friendsSentinelRef = useRef<HTMLDivElement>(null);
  const everyoneSentinelRef = useRef<HTMLDivElement>(null);

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

  // Store volatile pagination state in a ref so the observer stays stable
  const paginationRef = useRef({
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  });
  paginationRef.current = { fetchNextPage, hasNextPage, isFetchingNextPage };

  // Infinite scroll observer — created once
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const p = paginationRef.current;
        for (const entry of entries) {
          if (entry.isIntersecting && p.hasNextPage && !p.isFetchingNextPage) {
            p.fetchNextPage();
          }
        }
      },
      { rootMargin: "200px" },
    );

    if (friendsSentinelRef.current)
      observer.observe(friendsSentinelRef.current);
    if (everyoneSentinelRef.current)
      observer.observe(everyoneSentinelRef.current);

    return () => observer.disconnect();
  }, []);

  const renderActivityColumn = (mode: Mode) => {
    const list = mode === "friends" ? friendsActivities : activities;
    return (
      <div className="w-1/2">
        <div
          ref={mode === "friends" ? friendsRef : everyoneRef}
          className="flex flex-col"
        >
          <div className="flex flex-col divide-y divide-zinc-200 *:p-4">
            {list.map((activity) => (
              <UserActivityCard
                activity={activity}
                key={activity.id}
                handleLike={handleLikeActivity}
              />
            ))}
            {list.length === 0 && (
              <div className="flex flex-col items-center justify-center h-64 text-zinc-500 p-8">
                <p>
                  {loading || actionLoading
                    ? "Loading..."
                    : `No ${mode === "friends" ? "friend " : ""}activity yet`}
                </p>
              </div>
            )}
          </div>
          {isFetchingNextPage && (
            <div className="flex justify-center py-4 text-zinc-400">
              Loading more...
            </div>
          )}
          <div
            ref={mode === "friends" ? friendsSentinelRef : everyoneSentinelRef}
            className="h-1"
          />
        </div>
      </div>
    );
  };

  return (
    <CenterLayout width="3xl">
      {action && (
        <div className="flex flex-col gap-y-8 mb-8 pt-5">
          <Link
            className="flex flex-row gap-x-2 items-center cursor-pointer hover:bg-zinc-50 self-start px-2 py-1 rounded border border-zinc-200"
            to={href("/actions/:id", { id: action.id.toString() })}
          >
            <img src={chevronLeft} className="w-3 h-3 rotate-90" />
            Back to action
          </Link>
          <p className="text-title-small">{action.name}</p>
        </div>
      )}

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
                  ? "!border-b-green text-black"
                  : "!border-b-transparent hover:!border-b-zinc-200 text-zinc-500",
              )}
            >
              <p className="capitalize">{m}</p>
            </Button>
          ))}
        </div>
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

export default ActionActivityFeedPage;
