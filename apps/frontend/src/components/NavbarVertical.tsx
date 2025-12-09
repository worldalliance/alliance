import { Link, href, useOutletContext } from "react-router";
import { AppLayoutOutletContext } from "../applayout";
import ProfileImage from "@alliance/shared/ui/ProfileImage";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNotifications } from "../lib/useNotifications";
import { useAuth } from "../lib/AuthContext";
import { Features } from "@alliance/shared/lib/features";
import { isFeatureEnabled } from "../lib/config";
import { useMessagingUnread } from "../pages/app/messages";
import {
  MessageSquare,
  Search,
  Bell,
  ListTodo,
  BookText,
  Settings,
  Users,
  Globe,
  Layers,
  Menu,
  FileText,
  MessagesSquare,
} from "lucide-react";

export enum NavbarPage {
  Tasks = "Tasks",
  Notifications = "Notifications",
  CurrentActions = "Actions",
  Activity = "Activity",
  Forum = "Forum",
  Information = "Information",
  Profile = "Profile",
  Contract = "Contract",
  Settings = "Settings",
  Search = "Search",
  Groups = "Groups",
  Messages = "Messages",
}

export const destinations: Record<NavbarPage, string> = {
  [NavbarPage.Tasks]: href("/tasks"),
  [NavbarPage.Notifications]: href("/notifications"),
  [NavbarPage.CurrentActions]: href("/actions"),
  [NavbarPage.Search]: href("/search"),
  [NavbarPage.Activity]: href("/feed"),
  [NavbarPage.Forum]: href("/forum"),
  [NavbarPage.Information]: href("/information"),
  [NavbarPage.Profile]: href("/profile"),
  [NavbarPage.Contract]: href("/contract"),
  [NavbarPage.Settings]: href("/settings"),
  [NavbarPage.Groups]: href("/groups"),
  [NavbarPage.Messages]: href("/messages"),
};

const getIcon = (page: NavbarPage, size: number) => {
  switch (page) {
    case NavbarPage.Tasks:
      return <ListTodo size={size} />;
    case NavbarPage.Notifications:
      return <Bell size={size} />;
    case NavbarPage.CurrentActions:
      return <Layers size={size} />;
    case NavbarPage.Search:
      return <Search size={size} />;
    case NavbarPage.Messages:
      return <MessageSquare size={size} />;
    case NavbarPage.Information:
      return <BookText size={size} />;
    case NavbarPage.Forum:
      return <MessagesSquare size={size} />;
    case NavbarPage.Contract:
      return <FileText size={size} />;
    case NavbarPage.Settings:
      return <Settings size={size} />;
    case NavbarPage.Groups:
      return <Users size={size} />;
    case NavbarPage.Activity:
      return <Globe size={size} />;
    default:
      return null;
  }
};

const NavbarVertical: React.FC<{ todoActions: number }> = ({
  todoActions,
}: {
  todoActions: number;
}) => {
  const { profile } = useOutletContext<AppLayoutOutletContext>();

  const { unreadCount } = useNotifications();

  const { unread: unreadMessages } = useMessagingUnread();

  const [open, setOpen] = useState(false);
  const navRef = useRef<HTMLDivElement | null>(null);
  const mobileNavRef = useRef<HTMLDivElement | null>(null);

  const { user } = useAuth();

  const navSections = [
    {
      title: "",
      items: [
        {
          page: NavbarPage.Tasks,
          destination: destinations[NavbarPage.Tasks],
        },
        {
          page: NavbarPage.Notifications,
          destination: destinations[NavbarPage.Notifications],
        },
      ],
    },
    {
      title: "Platform",
      items: [
        {
          page: NavbarPage.CurrentActions,
          destination: destinations[NavbarPage.CurrentActions],
        },

        {
          page: NavbarPage.Information,
          destination: destinations[NavbarPage.Information],
        },
        {
          page: NavbarPage.Search,
          destination: destinations[NavbarPage.Search],
        },
      ],
    },
    {
      title: "Social",
      items: [
        {
          page: NavbarPage.Activity,
          destination: destinations[NavbarPage.Activity],
        },
        {
          page: NavbarPage.Forum,
          destination: destinations[NavbarPage.Forum],
        },
        ...(user?.communities.length ||
        user?.invitedCommunities.filter((invite) => invite.status === "pending")
          .length
          ? [
              {
                page: NavbarPage.Groups,
                destination: destinations[NavbarPage.Groups],
              },
            ]
          : []),
        ...(isFeatureEnabled(Features.Messaging)
          ? [
              {
                page: NavbarPage.Messages,
                destination: destinations[NavbarPage.Messages],
              },
            ]
          : []),
      ],
    },
    {
      title: "Profile",
      items: [
        {
          page: NavbarPage.Profile,
          destination: destinations[NavbarPage.Profile],
        },
        {
          page: NavbarPage.Contract,
          destination: destinations[NavbarPage.Contract],
        },
        {
          page: NavbarPage.Settings,
          destination: destinations[NavbarPage.Settings],
        },
      ],
    },
  ];

  const updateNavWidth = useCallback(() => {
    if (navRef.current) {
      document.documentElement.style.setProperty(
        "--nav-width",
        `${navRef.current.offsetWidth}px`
      );
    }
  }, []);

  const updateMobileNavHeight = useCallback(() => {
    if (mobileNavRef.current) {
      document.documentElement.style.setProperty(
        "--mobile-nav-height",
        `${mobileNavRef.current.offsetHeight}px`
      );
    }
  }, []);

  useLayoutEffect(() => {
    updateNavWidth();
    updateMobileNavHeight();

    const handleResize = () => {
      updateNavWidth();
      updateMobileNavHeight();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [updateNavWidth, updateMobileNavHeight]);

  const profilePicture = profile?.profilePicture || null;

  //   if (!isAuthenticated && !loading) return null;

  const currentLocation: NavbarPage | null =
    navSections
      .flatMap((section) => section.items)
      .find((item) => item.destination === window.location.pathname)?.page ||
    null;

  const unreadNotifsForPage = useMemo((): Partial<
    Record<NavbarPage, number>
  > => {
    return {
      [NavbarPage.Notifications]: unreadCount,
      [NavbarPage.Tasks]: todoActions,
      [NavbarPage.Groups]: user?.communities.length
        ? 0
        : user?.invitedCommunities.filter(
            (invite) => invite.status === "pending"
          ).length,
      [NavbarPage.Messages]:
        currentLocation !== NavbarPage.Messages ? unreadMessages : 0,
    };
  }, [unreadCount, todoActions, user, unreadMessages, currentLocation]);

  return (
    <>
      {/* MOBILE TOP BAR */}
      <div
        className="md:hidden flex items-center justify-between px-3 py-4 bg-white border-b border-zinc-200 fixed top-0 left-0 right-0 z-30"
        ref={mobileNavRef}
      >
        <button
          onClick={() => setOpen(!open)}
          className="text-xl rounded-md hover:bg-zinc-100 focus:outline-none"
          aria-label="Toggle navigation"
        >
          <div className="relative text-4xl">
            <Menu size={24} />
            {(unreadCount > 0 ||
              (todoActions > 0 && currentLocation !== NavbarPage.Tasks)) && (
              <div className="absolute -right-0.5 top-0 w-2 h-2 bg-red-500 rounded-full"></div>
            )}
          </div>
        </button>

        <Link
          to={destinations[NavbarPage.Profile]}
          className="flex items-center gap-x-2"
        >
          <ProfileImage pfp={profilePicture} size="medium" />
        </Link>
      </div>

      <aside
        id="side-nav"
        className={`fixed top-0 left-0 h-screen w-screen sm:w-60 lg:w-72 bg-zinc-50 border-r border-zinc-200 flex flex-col transform transition-transform duration-100 ease-in-out z-30 overflow-y-auto
        ${
          open ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 md:shadow-none`}
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
          <p className="p-3 font-berlingske uppercase text-xl mb-12 h-sm">
            The Alliance
          </p>

          <div className="flex flex-col w-full divide-y divide-zinc-200">
            {navSections.map((section) => (
              <nav key={section.title} className="flex flex-col py-4 w-full">
                {section.items.map((item) =>
                  item.page === NavbarPage.Profile ? (
                    <Link
                      key={item.page}
                      to={destinations[NavbarPage.Profile]}
                      prefetch="render"
                      className={`hidden md:flex p-3 hover:bg-zinc-100 rounded items-center justify-between w-full`}
                    >
                      <div className="text-zinc-700 flex items-center gap-x-2.5">
                        <ProfileImage pfp={profilePicture} size="small" />
                        <span>{profile?.displayName}</span>
                      </div>
                    </Link>
                  ) : (
                    <Link
                      key={item.page}
                      to={item.destination}
                      prefetch="render"
                      className={`px-3 py-1.5 rounded flex items-center justify-between w-full pr-2 ${
                        currentLocation === item.page
                          ? "bg-zinc-200/80 text-black"
                          : "text-zinc-700 hover:bg-zinc-100"
                      }`}
                      onClick={() => setOpen(false)}
                    >
                      <div className="flex items-center gap-x-2">
                        {getIcon(item.page, 16)}
                        <p>{item.page}</p>
                      </div>
                      {!!unreadNotifsForPage[item.page] && (
                        <div
                          className={`font-semibold text-xs text-white ${
                            item.page === NavbarPage.Tasks
                              ? "bg-red-500"
                              : "bg-zinc-500"
                          } rounded-md flex justify-center items-center w-5 h-5`}
                        >
                          {unreadNotifsForPage[item.page]}
                        </div>
                      )}
                    </Link>
                  )
                )}
              </nav>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
};

export default NavbarVertical;
