import { NotificationDto } from "@alliance/shared/client";
import { formatTime } from "@alliance/shared/lib/utils";
import { AvatarGroup, AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import { CheckCheck } from "lucide-react";

export interface NotificationTextProps {
  notification: NotificationDto;
  handleNotifClick: (notification: NotificationDto) => () => void;
  handleMarkAsRead?: (notification: NotificationDto) => () => void;
  className?: string;
}

const NotificationText = ({
  notification,
  handleNotifClick,
  handleMarkAsRead,
  className,
}: NotificationTextProps) => {
  return (
    <div className={className} onClick={handleNotifClick(notification)}>
      <h3 className="line-clamp-2">
        {notification.associatedUsers.length > 0 && (
          <AvatarGroup className="inline-flex mr-1 h-6 align-middle">
            {notification.associatedUsers.map((user) => (
              <AvatarProfile
                key={user.id}
                pfp={user.profilePicture}
                size="small"
              />
            ))}
          </AvatarGroup>
        )}
        {notification.category === "action_update" && (
          <span className="font-semibold">Action update: </span>
        )}
        {notification.message}
      </h3>
      <div className="flex items-center justify-between">
        <p className="text-zinc-500 text-sm">
          {formatTime(
            new Date(notification.sendTime || notification.createdAt),
            {
              addSuffix: true,
            },
          )}
        </p>
        {!notification.readAt && handleMarkAsRead && (
          <button
            type="button"
            className="flex items-center gap-x-1 text-xs text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 rounded px-1.5 py-0.5 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              handleMarkAsRead(notification)();
            }}
          >
            <CheckCheck className="w-3 h-3" />
            Mark as read
          </button>
        )}
      </div>
    </div>
  );
};

export default NotificationText;
