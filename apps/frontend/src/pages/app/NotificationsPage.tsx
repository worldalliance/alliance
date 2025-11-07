import ProfileImage from "@alliance/shared/ui/ProfileImage";
import { useNotifications } from "../../lib/useNotifications";
import { formatTime } from "@alliance/shared/lib/utils";
import List from "@alliance/shared/ui/List";
import Button, { ButtonColor } from "@alliance/shared/ui/Button";

const NotificationsPage = () => {
  const { allNotifications, handleMarkAllAsRead, handleNotifClick } =
    useNotifications();

  return (
    <div className="flex flex-col bg-page items-center">
      <div className="py-8 sm:py-18 px-4 flex flex-col items-center w-[calc(min(650px,100%))] gap-y-6">
        <div className="w-full flex flex-row justify-between items-end">
          <h2 className="!font-medium font-serif !text-3xl md:!text-4xl">
            Notifications
          </h2>

          <Button color={ButtonColor.White} onClick={handleMarkAllAsRead}>
            Mark all as read
          </Button>
        </div>
        <List className="w-full">
          {allNotifications.map((notification) => (
            <div
              key={notification.id}
              className={`hover:bg-zinc-100 p-4 flex cursor-pointer flex-col gap-y-2 ${
                notification.read ? "bg-white" : "bg-red-50"
              }`}
              onClick={handleNotifClick(
                notification.id,
                notification.webAppLocation
              )}
            >
              <div className="flex flex-row items-center gap-x-2">
                {notification.associatedUser && (
                  <ProfileImage
                    pfp={notification.associatedUser.profilePicture}
                    size="small"
                  />
                )}
                <h3>{notification.message}</h3>
              </div>
              <p className=" text-zinc-500 text-sm">
                {formatTime(new Date(notification.createdAt), {
                  addSuffix: true,
                })}
              </p>
            </div>
          ))}
        </List>
      </div>
    </div>
  );
};

export default NotificationsPage;
