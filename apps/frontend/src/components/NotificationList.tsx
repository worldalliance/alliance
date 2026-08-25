import { forCount, withCount } from "@alliance/common/plural";
import { NotificationDto, notifsSetRead } from "@alliance/shared/client";
import {
  buildNotificationRenderItems,
  getUnreadLikesCount,
  LikesBucket,
} from "@alliance/shared/lib/notificationBucketing";
import {
  getNotificationIdentityKey,
  getNotificationReadRequest,
} from "@alliance/shared/lib/notificationIdentity";
import { cn } from "@alliance/shared/styles/util";
import { CheckCheck, ChevronDown, ChevronUp, Heart } from "lucide-react";
import { useMemo, useState } from "react";
import NotificationText from "../pages/app/NotificationText";

const LikesGroup = ({
  bucket,
  handleNotifClick,
  handleMarkAsRead,
  onMarkAllRead,
  itemClassName,
  inset = true,
}: {
  bucket: LikesBucket;
  handleNotifClick: (notification: NotificationDto) => () => void;
  handleMarkAsRead?: (notification: NotificationDto) => () => void;
  onMarkAllRead: () => void;
  itemClassName?: string;
  inset?: boolean;
}) => {
  const [expanded, setExpanded] = useState(false);
  const unreadCount = getUnreadLikesCount(bucket);

  return (
    <div
      className={cn(
        "flex flex-col p-4",
        !inset && "-m-4",
        unreadCount > 0 ? "bg-red-50" : "bg-white",
        !expanded && "hover:bg-zinc-100",
      )}
    >
      <div
        className={cn(
          "flex flex-row items-center justify-between cursor-pointer ",
        )}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex flex-row items-center gap-x-2">
          <Heart className="text-zinc-500" size={16} />
          <span className="text-zinc-600">
            {unreadCount > 0
              ? `${unreadCount} new ${forCount(unreadCount, "like")}`
              : withCount(bucket.likes.length, "like")}
          </span>
          {expanded ? (
            <ChevronUp className="text-zinc-400" size={16} />
          ) : (
            <ChevronDown className="text-zinc-400" size={16} />
          )}
        </div>
        {unreadCount > 0 && (
          <button
            className="flex flex-row items-center gap-x-1 text-xs text-zinc-500 hover:text-zinc-700 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onMarkAllRead();
            }}
          >
            <CheckCheck className="w-3 h-3" />
            Dismiss
          </button>
        )}
      </div>
      {expanded && (
        <div className="flex flex-col mt-2">
          {bucket.likes.map((notification) => (
            <NotificationText
              key={getNotificationIdentityKey(notification)}
              notification={notification}
              handleNotifClick={handleNotifClick}
              handleMarkAsRead={handleMarkAsRead}
              className={cn(
                // Don't highlight row when hovering the mark-as-read button
                "[&:not(:has(button:hover))]:hover:bg-zinc-100 py-3 pl-4 flex cursor-pointer flex-col gap-y-1",
                notification.readAt ? "bg-white" : "bg-red-50",
                itemClassName,
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export interface NotificationListProps {
  notifications: NotificationDto[];
  handleNotifClick: (notification: NotificationDto) => () => void;
  handleMarkAsRead?: (notification: NotificationDto) => () => void;
  refreshNotifications: () => void;
  itemClassName?: string;
  listClassName?: string;
  inset?: boolean;
}

const NotificationList = ({
  notifications,
  handleNotifClick,
  handleMarkAsRead,
  refreshNotifications,
  itemClassName,
  listClassName,
  inset = true,
}: NotificationListProps) => {
  const handleMarkBucketAsRead = (bucket: LikesBucket) => async () => {
    const unreadLikes = bucket.likes.filter((n) => !n.readAt);
    await Promise.all(
      unreadLikes.map((n) => notifsSetRead(getNotificationReadRequest(n))),
    );
    refreshNotifications();
  };

  const renderItems = useMemo(
    () => buildNotificationRenderItems(notifications),
    [notifications],
  );

  return (
    <div className={listClassName}>
      {renderItems.map((item) =>
        item.type === "likes-group" ? (
          <LikesGroup
            key={item.key}
            bucket={item.bucket}
            handleNotifClick={handleNotifClick}
            handleMarkAsRead={handleMarkAsRead}
            onMarkAllRead={handleMarkBucketAsRead(item.bucket)}
            itemClassName={itemClassName}
            inset={inset}
          />
        ) : (
          <NotificationText
            key={item.key}
            notification={item.notification}
            handleNotifClick={handleNotifClick}
            handleMarkAsRead={handleMarkAsRead}
            className={cn(
              // Don't highlight row when hovering the mark-as-read button
              "[&:not(:has(button:hover))]:hover:bg-zinc-100 p-4 flex cursor-pointer flex-col gap-y-2",
              item.notification.readAt ? "bg-white" : "bg-red-50",
              !inset && "-m-4",
              itemClassName,
            )}
          />
        ),
      )}
    </div>
  );
};

export default NotificationList;
