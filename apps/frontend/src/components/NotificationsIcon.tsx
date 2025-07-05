import {
  NotificationDto,
  notifsFindAll,
  notifsSetRead,
} from "@alliance/shared/client";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../lib/AuthContext";
import { useNavigate } from "react-router";
import { formatDate } from "date-fns";

function getWebAppLocation(webAppLocation: string) {
  if (webAppLocation.startsWith("/")) {
    return webAppLocation;
  }
  return "/" + webAppLocation;
}

const NotificationsIcon = () => {
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    notifsFindAll().then(
      ({ data: notifications }: { data: NotificationDto[] | undefined }) => {
        if (notifications) {
          setNotifications(notifications);
          setUnreadCount(
            notifications.filter((notification) => !notification.read).length
          );
        }
      }
    );
  }, [isAuthenticated]);

  const toggle = useCallback(() => {
    setIsOpen(!isOpen);
  }, [isOpen]);

  const handleNotifClick = useCallback(
    (id: number, webAppLocation: string) => () => {
      notifsSetRead({ path: { id } });
      setNotifications(
        notifications.map((notification) => ({
          ...notification,
          read: notification.id === id ? true : notification.read,
        }))
      );
      setUnreadCount(
        notifications.filter((notification) => !notification.read).length
      );
      navigate(getWebAppLocation(webAppLocation));
    },
    [navigate, notifications]
  );

  return (
    <div
      className={`${
        unreadCount > 0
          ? "bg-red-500 text-white"
          : "bg-white text-zinc-400 border-1 border-zinc-300"
      } w-7 h-7 rounded-full flex items-center justify-center cursor-pointer`}
      onClick={toggle}
    >
      <p className="font-avenir font-bold text-sm">{unreadCount}</p>
      {isOpen && (
        <div className="absolute top-8 shadow-lg/5 right-0 bg-white rounded border border-zinc-200 p-4 min-w-[370px] space-y-2">
          {notifications.length === 0 && (
            <p className="text-zinc-500">No notifications</p>
          )}
          {notifications.map((notification) => (
            <div
              key={notification.id}
              onClick={handleNotifClick(
                notification.id,
                notification.webAppLocation
              )}
              className={`text-black hover:bg-zinc-100 p-2 rounded-md flex gap-x-4 items-center ${
                !notification.read ? "bg-red-50" : ""
              }`}
            >
              <p className="text-gray-500 text-xs">
                {formatDate(notification.updatedAt, "MM/dd/yyyy")}
              </p>
              {notification.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotificationsIcon;
