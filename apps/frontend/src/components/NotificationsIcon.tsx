import { formatBadgeCount } from "@alliance/shared/lib/badgeCount";
import { NAV_BAR_ICON_HEIGHT } from "@alliance/shared/lib/constants";
import {
  useNotificationsList,
  useUnreadNotificationCount,
} from "@alliance/shared/lib/useNotificationsCache";
import { cn } from "@alliance/shared/styles/util";
import { useOutsideClick } from "@alliance/sharedweb/lib/useOutsideClick";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { zIndex } from "@alliance/sharedweb/ui/zIndex";
import { Bell } from "lucide-react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { href, useNavigate } from "react-router";
import {
  NOTIFICATIONS_PREVIEW_LIMIT,
  useNotificationActions,
} from "../lib/useNotificationActions";
import NotificationList from "./NotificationList";

const VIEWPORT_EDGE_PX = 8;

const NotificationsIcon = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [panelShiftX, setPanelShiftX] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const ref = useOutsideClick(() => setIsOpen(false));
  const notifications =
    useNotificationsList(NOTIFICATIONS_PREVIEW_LIMIT).data ?? [];
  const unreadCount = useUnreadNotificationCount();
  const { handleMarkAllAsRead, handleMarkAsRead, handleNotifClick } =
    useNotificationActions();
  const navigate = useNavigate();
  const unreadLabel = formatBadgeCount(unreadCount);
  const toggle = useCallback(() => {
    setIsOpen(!isOpen);
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) {
      setPanelShiftX(0);
      return;
    }
    const clampPanel = () => {
      const trigger = ref.current;
      const panel = panelRef.current;
      if (!trigger || !panel) return;
      const iw = window.innerWidth;
      const w = panel.offsetWidth;
      const anchorRight = trigger.getBoundingClientRect().right;
      const naturalLeft = anchorRight - w;
      const minLeft = VIEWPORT_EDGE_PX;
      const maxLeft = iw - VIEWPORT_EDGE_PX - w;
      let left: number;
      if (maxLeft < minLeft) {
        left = Math.max(0, Math.min(naturalLeft, iw - w));
      } else {
        left = Math.max(minLeft, Math.min(naturalLeft, maxLeft));
      }
      setPanelShiftX(left - naturalLeft);
    };
    clampPanel();
    window.addEventListener("resize", clampPanel);
    window.addEventListener("scroll", clampPanel, true);
    return () => {
      window.removeEventListener("resize", clampPanel);
      window.removeEventListener("scroll", clampPanel, true);
    };
  }, [isOpen, ref]);

  return (
    <div
      className={cn(
        "bg-grey-2 hover:bg-grey-3 text-black",
        "w-12 h-12 rounded-full flex items-center justify-center cursor-pointer relative overflow-visible",
      )}
      onClick={toggle}
      ref={ref}
    >
      <div className="flex items-center gap-x-0.5">
        <Bell size={NAV_BAR_ICON_HEIGHT} fill="black" />
      </div>
      {unreadLabel && (
        <span className="absolute -top-1 -right-1 min-w-5.5 h-5.5 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-xs font-medium">
          {unreadLabel}
        </span>
      )}
      {isOpen && (
        <div
          ref={panelRef}
          className={cn(
            zIndex.popover,
            "absolute right-0 top-full mt-1 shadow-lg/5 bg-white rounded p-4 space-y-2 max-h-[500px] overflow-y-auto cursor-default w-[min(450px,calc(100vw-1rem))]",
          )}
          style={
            panelShiftX !== 0
              ? { transform: `translateX(${panelShiftX}px)` }
              : undefined
          }
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col md:flex-row justify-between items-center mb-6">
            <p className="text-title-small text-black">Notifications</p>
            <div className="flex flex-row gap-x-1">
              <Button
                color={ButtonColor.Grey}
                size="mediumDynamic"
                onClick={() => {
                  setIsOpen(false);
                  navigate(href("/notifications"));
                }}
              >
                See all
              </Button>
              <Button
                color={ButtonColor.Grey}
                size="mediumDynamic"
                onClick={handleMarkAllAsRead(NOTIFICATIONS_PREVIEW_LIMIT)}
              >
                Mark all as read
              </Button>
            </div>
          </div>
          {notifications.length === 0 ? (
            <p className="text-zinc-500 text-center py-2">No notifications</p>
          ) : (
            <NotificationList
              notifications={notifications}
              handleNotifClick={handleNotifClick}
              handleMarkAsRead={handleMarkAsRead}
              listClassName="flex flex-col gap-y-8 divide-y divide-grey-2"
              inset={false}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationsIcon;
