import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, href } from "react-router";
import { formatTime } from "@alliance/shared/lib/utils";
import {
  AvatarProfile,
  AvatarGroup,
  AvatarGroupCount,
} from "@alliance/sharedweb/ui/Avatar";
import Spinner from "@alliance/sharedweb/ui/Spinner";
import {
  GlobalFeedActivityGroupDto,
  GlobalFeedForumCommentsDto,
  GlobalFeedItemDto,
  GlobalFeedNewMembersDto,
  // GlobalFeedNewMembersDto,
  ProfileDto,
} from "@alliance/shared/client";
import { actionActivityTransitiveVerb } from "@alliance/shared/lib/actionActivityConstants";

interface ProfilePicRowProps {
  users: ProfileDto[];
  maxDisplay?: number;
  showExtraCount?: boolean;
}

const ProfilePicRow = ({
  users,
  maxDisplay = 20,
  showExtraCount = false,
}: ProfilePicRowProps) => {
  const displayUsers = users.slice(0, maxDisplay);
  const extraCount = users.length > maxDisplay ? users.length - maxDisplay : 0;

  return (
    <AvatarGroup className="items-center inline-flex mr-1 ml-1">
      {displayUsers.map((user) => (
        <Link
          key={user.id}
          to={href("/member/:id", { id: user.id.toString() })}
          className="hover:z-10 transition-transform hover:scale-110 duration-75"
        >
          <AvatarProfile pfp={user.profilePicture ?? null} size="small" />
        </Link>
      ))}
      {showExtraCount && extraCount > 0 && (
        <AvatarGroupCount size="small">+{extraCount}</AvatarGroupCount>
      )}
    </AvatarGroup>
  );
};

interface ActivityGroupItemProps {
  item: GlobalFeedActivityGroupDto;
  date: string;
}

const ActivityGroupItem = ({ item, date }: ActivityGroupItemProps) => {
  const verb = actionActivityTransitiveVerb[item.activityType] satisfies string;
  const isSingle = item.count === 1 && item.users.length > 0;

  return (
    <div className="py-3">
      <div className="text-zinc-700 mt-1.5">
        <ProfilePicRow users={item.users} />
        {isSingle ? (
          <Link
            to={href("/member/:id", { id: item.users[0].id.toString() })}
            className="font-medium hover:underline"
          >
            {item.users[0].displayName}
          </Link>
        ) : (
          <span className="font-medium">{item.count} members</span>
        )}
        <span className="text-zinc-500"> {verb} </span>
        <Link
          to={href("/actions/:id", { id: item.actionId.toString() })}
          className="text-green font-medium hover:underline"
        >
          {item.actionName}
        </Link>
        <span className="text-zinc-500">
          {" "}
          {formatTime(new Date(date), { addSuffix: true })}
        </span>
      </div>
    </div>
  );
};

// interface ActionUpdateItemProps {
//   item: GlobalFeedActionUpdateDto;
// }

// const ActionUpdateItem = ({ item }: ActionUpdateItemProps) => {
//   return (
//     <Link
//       to={href("/actions/:id", { id: item.actionId.toString() })}
//       className="block py-3 hover:bg-zinc-50 px-2 rounded"
//     >
//       <div className="flex flex-row gap-x-2 items-center">
//         <p className="text-zinc-500 text-sm">
//           <Info className="text-green inline-block -mt-1" size={14} /> Update on{" "}
//           <span className="text-green">{item.actionName}</span>
//         </p>
//       </div>
//       <p className="text-black font-medium mt-1">{item.title}</p>
//       <p className="text-zinc-400 text-sm mt-0.5">
//         {formatTime(new Date(item.date), { addSuffix: true })}
//       </p>
//     </Link>
//   );
// };

interface NewMembersItemProps {
  item: GlobalFeedNewMembersDto;
  date: string;
}

const NewMembersItem = ({ item }: NewMembersItemProps) => {
  const [expanded, setExpanded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const isSingle = item.count === 1 && item.users.length > 0;

  return (
    <div className="py-3">
      <div className="text-zinc-700 mt-1.5">
        <ProfilePicRow users={item.users} maxDisplay={8} />
        {isSingle ? (
          <>
            <Link
              to={href("/member/:id", { id: item.users[0].id.toString() })}
              className="font-medium hover:underline"
            >
              {item.users[0].displayName}
            </Link>
            <span className="text-zinc-500">{" joined the Alliance"}</span>
          </>
        ) : (
          <span
            onClick={() => setExpanded(!expanded)}
            className="cursor-pointer text-left hover:text-zinc-900"
          >
            <span className="font-medium">{item.count} new members</span>
            <span className="text-zinc-500"> joined the Alliance</span>
          </span>
        )}
      </div>
      {!isSingle && (
        <div
          className="overflow-hidden transition-all duration-300 ease-in-out"
          style={{
            maxHeight: expanded ? contentRef.current?.scrollHeight ?? 0 : 0,
            opacity: expanded ? 1 : 0,
          }}
        >
          <div
            ref={contentRef}
            className="pt-3 pl-2 space-y-1 max-h-80 overflow-y-auto"
          >
            {item.users.map((user) => (
              <Link
                key={user.id}
                to={href("/member/:id", { id: user.id.toString() })}
                className="flex items-center gap-2 hover:bg-zinc-50 rounded py-2 -ml-2"
              >
                <AvatarProfile pfp={user.profilePicture ?? null} size="small" />
                <span className="text-zinc-700">{user.displayName}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface ForumCommentsItemProps {
  item: GlobalFeedForumCommentsDto;
  date: string;
}

const ForumCommentsItem = ({ item, date }: ForumCommentsItemProps) => {
  const isSingle = item.count === 1 && item.users.length > 0;
  const postUrl =
    isSingle && item.commentId
      ? `${href("/forum/post/:id", { id: item.postId.toString() })}?replyId=${
          item.commentId
        }`
      : href("/forum/post/:id", { id: item.postId.toString() });

  return (
    <div className="block py-3 -mx-2 px-2 rounded">
      <div className="text-zinc-700 mt-1.5">
        <ProfilePicRow users={item.users} />
        {isSingle ? (
          <span className="font-medium">{item.users[0].displayName}</span>
        ) : (
          <span className="font-medium">{item.count} members</span>
        )}
        <span className="text-zinc-500"> commented on </span>
        <Link to={postUrl} className="text-green font-medium hover:underline">
          {item.postTitle}
        </Link>
        <span className="text-zinc-500">
          {" "}
          {formatTime(new Date(date), { addSuffix: true })}
        </span>
      </div>
    </div>
  );
};

interface GlobalFeedProps {
  items: GlobalFeedItemDto[];
  loading?: boolean;
  fitToHeight?: boolean;
}

const GlobalFeed = ({
  items,
  loading,
  fitToHeight = false,
}: GlobalFeedProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState<number | null>(null);

  const displayItems =
    fitToHeight && visibleCount !== null ? items.slice(0, visibleCount) : items;

  // When items change, reset to render all items for measurement
  useLayoutEffect(() => {
    if (fitToHeight) {
      setVisibleCount(null);
    }
  }, [items, fitToHeight]);

  // Measure how many items fully fit in the container
  useLayoutEffect(() => {
    if (!fitToHeight || visibleCount !== null) return;
    const container = containerRef.current;
    if (!container || items.length === 0) return;

    const availableHeight = container.clientHeight;
    const itemsWrapper = container.firstElementChild as HTMLElement;
    if (!itemsWrapper) return;

    const children = itemsWrapper.children;
    const containerTop = container.getBoundingClientRect().top;
    let count = 0;

    for (let i = 0; i < children.length; i++) {
      const childRect = (children[i] as HTMLElement).getBoundingClientRect();
      if (childRect.bottom - containerTop <= availableHeight) {
        count = i + 1;
      } else {
        break;
      }
    }

    setVisibleCount(Math.max(count, 1));
  }, [fitToHeight, visibleCount, items]);

  // Re-measure when available space changes (window resize or layout shifts)
  useEffect(() => {
    if (!fitToHeight) return;

    const handleResize = () => setVisibleCount(null);
    window.addEventListener("resize", handleResize);

    // Also observe the container for non-window layout changes
    // (e.g. progress section expanding/collapsing)
    const container = containerRef.current;
    let observer: ResizeObserver | undefined;
    if (container) {
      let lastHeight = Math.round(container.getBoundingClientRect().height);
      observer = new ResizeObserver(() => {
        const newHeight = Math.round(container.getBoundingClientRect().height);
        if (newHeight !== lastHeight) {
          lastHeight = newHeight;
          handleResize();
        }
      });
      observer.observe(container);
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      observer?.disconnect();
    };
  }, [fitToHeight]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner size="medium" />
      </div>
    );
  }

  if (items.length === 0) {
    return <p className="text-zinc-400  py-4">No recent activity</p>;
  }

  return (
    <div
      ref={containerRef}
      className={fitToHeight ? "flex-1 min-h-0 overflow-hidden" : ""}
    >
      <div className="divide-y divide-zinc-100">
        {displayItems.map(
          (item, index) =>
            item.type !== "action_update" && (
              <div key={`${item.type}-${index}-${item.date}`}>
                {item.type === "activity_group" && item.activityGroup && (
                  <ActivityGroupItem
                    item={item.activityGroup}
                    date={item.date}
                  />
                )}
                {/* {item.type === "action_update" && item.actionUpdate && (
              <ActionUpdateItem item={item.actionUpdate} />
            )} */}
                {item.type === "new_members" && item.newMembers && (
                  <NewMembersItem item={item.newMembers} date={item.date} />
                )}
                {item.type === "forum_comments" && item.forumComments && (
                  <ForumCommentsItem
                    item={item.forumComments}
                    date={item.date}
                  />
                )}
              </div>
            )
        )}
      </div>
    </div>
  );
};

export default GlobalFeed;
