import { useNotificationsList } from "@alliance/shared/lib/useNotificationsCache";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import CenterLayout from "@alliance/sharedweb/ui/CenterLayout";
import List from "@alliance/sharedweb/ui/List";
import Spinner from "@alliance/sharedweb/ui/Spinner";
import NotificationList from "../../components/NotificationList";
import { useNotificationActions } from "../../lib/useNotificationActions";

const NotificationsPage = () => {
  const { data, isPending } = useNotificationsList();
  const notifications = data ?? [];
  const { handleMarkAllAsRead, handleMarkAsRead, handleNotifClick } =
    useNotificationActions();

  const unreadCount = notifications.filter(
    (notification) => !notification.readAt,
  ).length;

  return (
    <CenterLayout>
      <div className="flex flex-col items-center w-[calc(min(650px,100%))] gap-y-6">
        <div className="w-full flex flex-row justify-between items-end">
          <h1 className="text-title">Notifications</h1>
          {unreadCount > 0 && (
            <Button color={ButtonColor.Grey} onClick={handleMarkAllAsRead()}>
              Mark all as read
            </Button>
          )}
        </div>
        {isPending ? (
          <Spinner />
        ) : (
          <List className="w-full border-none">
            <NotificationList
              notifications={notifications}
              handleNotifClick={handleNotifClick}
              handleMarkAsRead={handleMarkAsRead}
              listClassName="divide-y divide-grey-2"
            />
          </List>
        )}
      </div>
    </CenterLayout>
  );
};

export default NotificationsPage;
