import { Features } from "@alliance/shared/lib/features";
import useIncomingCommunityInvites from "@alliance/shared/lib/useIncomingCommunityInvites";
import { cn } from "@alliance/shared/styles/util";
import BottomSpacer from "@alliance/sharedweb/ui/BottomSpacer";
import {
  BookText,
  Globe,
  Layers,
  ListTodo,
  MessageSquare,
  UserPlus,
  Users,
} from "lucide-react";
import {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { Link, href, useLocation } from "react-router";
import { useAuth } from "../lib/AuthContext";
import { isFeatureEnabled } from "../lib/config";
import { NavbarOptionsContext } from "../lib/NavbarOptionsContext";
import { useMessagingUnread } from "../pages/app/messages";

export enum NavbarPage {
  Tasks = "Tasks",
  CurrentActions = "Actions",
  Activity = "Activity",
  Information = "Information",
  Groups = "Groups",
  Messages = "Messages",
  Invite = "Invites",
}

export const destinations: Record<NavbarPage, string> = {
  [NavbarPage.Tasks]: href("/tasks"),
  [NavbarPage.CurrentActions]: href("/actions"),
  [NavbarPage.Activity]: href("/feed"),
  [NavbarPage.Information]: href("/information"),
  [NavbarPage.Groups]: href("/groups"),
  [NavbarPage.Messages]: href("/messages"),
  [NavbarPage.Invite]: href("/invites"),
};

const getIcon = (page: NavbarPage, size: number) => {
  switch (page) {
    case NavbarPage.Tasks:
      return <ListTodo size={size} />;
    case NavbarPage.CurrentActions:
      return <Layers size={size} />;
    case NavbarPage.Messages:
      return <MessageSquare size={size} />;
    case NavbarPage.Information:
      return <BookText size={size} />;
    case NavbarPage.Groups:
      return <Users size={size} />;
    case NavbarPage.Activity:
      return <Globe size={size} />;
    case NavbarPage.Invite:
      return <UserPlus size={size} />;
    default:
      page satisfies never;
      return null;
  }
};

const NavbarVertical: React.FC<{
  todoActions: number;
  mobileNavOpen: boolean;
  onMobileNavOpenChange: (open: boolean) => void;
  whiteBackground?: boolean;
}> = ({
  todoActions,
  mobileNavOpen: open,
  onMobileNavOpenChange: setOpen,
  whiteBackground = false,
}: {
  todoActions: number;
  mobileNavOpen: boolean;
  onMobileNavOpenChange: (open: boolean) => void;
  whiteBackground?: boolean;
}) => {
  const { isAuthenticated } = useAuth();
  const navbarOptions = useContext(NavbarOptionsContext);
  const noBorder = navbarOptions?.options?.noBorder ?? false;
  const location = useLocation();

  const { pendingCommunityInvites } = useIncomingCommunityInvites();

  const {
    unread: unreadMessages,
    hasUpdates,
    updateTick,
    setUnread,
    setHasUpdates,
    refreshUnreadCount,
  } = useMessagingUnread();

  const navRef = useRef<HTMLDivElement | null>(null);

  const navItems = [
    { page: NavbarPage.Tasks, destination: destinations[NavbarPage.Tasks] },
    {
      page: NavbarPage.CurrentActions,
      destination: destinations[NavbarPage.CurrentActions],
    },
    {
      page: NavbarPage.Activity,
      destination: destinations[NavbarPage.Activity],
    },
    { page: NavbarPage.Groups, destination: destinations[NavbarPage.Groups] },
    ...(isFeatureEnabled(Features.Messaging)
      ? [
          {
            page: NavbarPage.Messages,
            destination: destinations[NavbarPage.Messages],
          },
        ]
      : []),
    { page: NavbarPage.Invite, destination: destinations[NavbarPage.Invite] },
    {
      page: NavbarPage.Information,
      destination: destinations[NavbarPage.Information],
    },
  ];

  const updateNavWidth = useCallback(() => {
    if (navRef.current) {
      document.documentElement.style.setProperty(
        "--nav-width",
        `${navRef.current.offsetWidth}px`,
      );
    }
  }, []);

  useLayoutEffect(() => {
    updateNavWidth();

    const handleResize = () => {
      updateNavWidth();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [updateNavWidth]);

  useEffect(() => {
    const handleDocumentMouseDown = (event: MouseEvent) => {
      const el = navRef.current;
      if (!el) return;

      const target = event.target as Node | null;

      // If click is outside the navbar, close the navbar
      if (target && el.contains(target)) {
        return;
      }

      setOpen(false);
    };

    document.addEventListener("mousedown", handleDocumentMouseDown);
    return () => {
      document.removeEventListener("mousedown", handleDocumentMouseDown);
    };
  });

  const currentLocation: NavbarPage | null =
    navItems.find((item) => item.destination === location.pathname)?.page ||
    null;

  useEffect(() => {
    if (currentLocation !== NavbarPage.Messages && hasUpdates) {
      refreshUnreadCount();
    }
  }, [hasUpdates, updateTick, refreshUnreadCount, currentLocation]);

  useEffect(() => {
    if (currentLocation === NavbarPage.Messages) {
      setUnread(0);
      setHasUpdates(true);
    }
  }, [currentLocation, setUnread, setHasUpdates]);

  const unreadNotifsForPage = useMemo((): Record<NavbarPage, number> => {
    return {
      [NavbarPage.Tasks]: todoActions,
      [NavbarPage.Groups]: pendingCommunityInvites.length,
      [NavbarPage.Messages]:
        currentLocation !== NavbarPage.Messages ? unreadMessages : 0,
      [NavbarPage.CurrentActions]: 0,
      [NavbarPage.Activity]: 0,
      [NavbarPage.Information]: 0,
      [NavbarPage.Invite]: 0,
    };
  }, [todoActions, pendingCommunityInvites, unreadMessages, currentLocation]);

  const getBadgeLabel = (count: number) => {
    if (!count) {
      return null;
    }
    return Math.min(count, 99).toString();
  };

  useEffect(() => {
    if (typeof document === "undefined") return;

    if (!isAuthenticated) {
      document.documentElement.style.setProperty("--nav-width", "0px");
      return;
    }

    if (
      document.documentElement.style.getPropertyValue("--nav-width") === "0px"
    ) {
      requestAnimationFrame(() => {
        updateNavWidth();
      });
    }
  }, [isAuthenticated, updateNavWidth]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      <aside
        id="side-nav"
        className={cn(
          "fixed top-0 left-0 h-screen w-screen sm:w-[clamp(14rem,18vw,17rem)]",
          whiteBackground ? "bg-white" : "bg-page",
          "flex flex-col",
          !noBorder && "border-r border-zinc-200",
          "transform transition-transform duration-100 ease-in-out",
          "z-30 overflow-y-auto",
          "md:shadow-none",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
        ref={navRef}
      >
        {/* Close button on mobile */}
        <div className="md:hidden flex justify-end p-4">
          <button
            onClick={() => setOpen(false)}
            className="text-zinc-500 hover:text-black focus:outline-none text-3xl"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col items-start px-4 py-4">
          <Link to={href("/")}>
            <p className="p-3 font-berlingske uppercase text-xl mb-12 h-sm">
              The Alliance
            </p>
          </Link>

          <nav className="flex flex-col w-full py-4 gap-y-2 text-lg">
            {navItems.map((item) => (
              <Link
                key={item.page}
                to={item.destination}
                prefetch="render"
                className={cn(
                  "px-3 py-1.5 rounded-md flex items-center justify-between w-full pr-2",
                  currentLocation === item.page
                    ? "bg-zinc-200/80 text-black"
                    : "text-zinc-700 hover:bg-zinc-100",
                )}
                onClick={() => setOpen(false)}
              >
                <div className="flex items-center gap-x-3">
                  {getIcon(item.page, 20)}
                  <p>{item.page}</p>
                </div>
                {!!unreadNotifsForPage[item.page] && (
                  <div
                    className={cn(
                      "font-semibold text-xs text-white",
                      "rounded-full px-1",
                      "flex justify-center items-center",
                      "min-w-5 h-5",
                      item.page === NavbarPage.Tasks
                        ? "bg-red-500"
                        : "bg-zinc-500",
                    )}
                  >
                    {getBadgeLabel(unreadNotifsForPage[item.page])}
                  </div>
                )}
              </Link>
            ))}
          </nav>

          <BottomSpacer />
        </div>
      </aside>
    </>
  );
};

export default NavbarVertical;
