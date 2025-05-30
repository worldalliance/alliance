import {
  NotificationDto,
  notifsFindAll,
  notifsSetRead,
} from "@alliance/shared/client";
import { useCallback, useEffect, useState } from "react";

const NotificationsIcon = () => {
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    notifsFindAll().then((notifications) => {
      if (notifications.data) {
        setNotifications(notifications.data);
        setUnreadCount(
          notifications.data.filter((notification) => !notification.read).length
        );
      }
    });
  }, []);

  const toggle = useCallback(() => {
    setIsOpen(!isOpen);
  }, [isOpen]);

  const handleNotifClick = useCallback(
    (id: number) => () => {
      notifsSetRead({ path: { id } });
    },
    []
  );

  //   if (unreadCount === 0) {
  //     return null;
  //   }

  return (
    <div
      className={`${
        unreadCount > 0 ? "bg-red-500" : "bg-zinc-300"
      } text-white w-7 h-7 rounded-full flex items-center justify-center cursor-pointer`}
      onClick={toggle}
    >
      <p className="font-avenir font-bold text-sm">{unreadCount}</p>
      {isOpen && (
        <div className="absolute top-8 right-0 bg-white rounded border border-zinc-200 p-4 min-w-[200px]">
          {notifications.length === 0 && (
            <p className="text-zinc-500">No notifications</p>
          )}
          {notifications.map((notification) => (
            <div
              key={notification.id}
              onClick={handleNotifClick(notification.id)}
            >
              {notification.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotificationsIcon;
