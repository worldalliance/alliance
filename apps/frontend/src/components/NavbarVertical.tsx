import { Link, useNavigate, useOutletContext } from "react-router";
import { useAuth } from "../lib/AuthContext";
import { AppLayoutOutletContext } from "../applayout";
import ProfileImage from "@alliance/shared/ui/ProfileImage";
import { useCallback, useState } from "react";
import { useNotifications } from "../lib/useNotifications";

export enum NavbarPage {
  Tasks = "Tasks",
  Notifications = "Notifications",
  CurrentActions = "Actions",
  Activity = "Activity",
  Forum = "Forum",
  Priorities = "Priorities",
  Profile = "Profile",
  Contract = "Contract",
  Settings = "Settings",
  Search = "Search",
  LogOut = "Log Out",
}

export const destinations: Record<NavbarPage, string> = {
  [NavbarPage.Tasks]: "/tasks",
  [NavbarPage.Notifications]: "/notifications",
  [NavbarPage.CurrentActions]: "/actions",
  [NavbarPage.Search]: "/search",
  [NavbarPage.Activity]: "/feed",
  [NavbarPage.Forum]: "/forum",
  [NavbarPage.Priorities]: "/priorities",
  [NavbarPage.Profile]: "/profile",
  [NavbarPage.Contract]: "/contract",
  [NavbarPage.Settings]: "/settings",
  [NavbarPage.LogOut]: "#",
};

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
        page: NavbarPage.Activity,
        destination: destinations[NavbarPage.Activity],
      },
      {
        page: NavbarPage.Forum,
        destination: destinations[NavbarPage.Forum],
      },
      {
        page: NavbarPage.Priorities,
        destination: destinations[NavbarPage.Priorities],
      },
      {
        page: NavbarPage.Search,
        destination: destinations[NavbarPage.Search],
      },
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
      {
        page: NavbarPage.LogOut,
        destination: "#",
      },
    ],
  },
];

const NavbarVertical: React.FC<{ todoActions: number }> = ({
  todoActions,
}: {
  todoActions: number;
}) => {
  const { isAuthenticated, loading } = useAuth();

  const { profile } = useOutletContext<AppLayoutOutletContext>();

  const { logout } = useAuth();
  const navigate = useNavigate();

  const { unreadCount } = useNotifications();

  const [open, setOpen] = useState(false);

  const handleLogout = useCallback(async () => {
    await logout();
    navigate("/tasks");
  }, [logout, navigate]);

  const profilePicture = profile?.profilePicture || null;

  if (!isAuthenticated && !loading) return null;

  const currentLocation: NavbarPage | null =
    navSections
      .flatMap((section) => section.items)
      .find((item) => item.destination === window.location.pathname)?.page ||
    null;

  return (
    <>
      {/* MOBILE TOP BAR */}
      <div
        className="md:hidden flex items-center justify-between px-4 py-3 bg-white shadow-sm fixed top-0 left-0 right-0 z-30"
        ref={(el) => {
          if (el) {
            document.documentElement.style.setProperty(
              "--mobile-nav-height",
              `${el.offsetHeight}px`
            );
          }
        }}
      >
        <button
          onClick={() => setOpen(!open)}
          className="p-2 text-xl rounded-md hover:bg-gray-100 focus:outline-none"
          aria-label="Toggle navigation"
        >
          ☰
        </button>
        <Link
          to={destinations[NavbarPage.Profile]}
          className="flex items-center gap-x-2"
        >
          <ProfileImage pfp={profilePicture} size="small" />
          <span className="">{profile?.displayName}</span>
        </Link>
      </div>

      <aside
        id="side-nav"
        className={`fixed top-0 left-0 h-screen w-screen sm:w-40 md:w-60 lg:w-72 bg-page shadow-md flex flex-col transform transition-transform duration-100 ease-in-out z-30
        ${
          open ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 md:shadow-none`}
        ref={(el) => {
          if (el) {
            document.documentElement.style.setProperty(
              "--nav-width",
              `${el.offsetWidth}px`
            );
          }
        }}
      >
        {/* Close button on mobile */}
        <div className="md:hidden flex justify-end p-4">
          <button
            onClick={() => setOpen(false)}
            className="text-gray-500 hover:text-black focus:outline-none"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col items-start px-2 py-4">
          <p className="p-3 font-berlingske uppercase text-xl mb-12">
            The Alliance
          </p>

          <div className="flex flex-col w-full">
            {navSections.map((section) => (
              <nav key={section.title} className="flex flex-col py-4 w-full">
                {section.items.map((item) => (
                  <>
                    {item.page === NavbarPage.LogOut ? (
                      <p
                        className="px-3 py-1.5 hover:bg-zinc-100 text-zinc-700 hover:text-red-500 rounded cursor-pointer"
                        onClick={handleLogout}
                      >
                        Log out
                      </p>
                    ) : item.page === NavbarPage.Profile ? (
                      <Link
                        to={destinations[NavbarPage.Profile]}
                        prefetch="render"
                        key={NavbarPage.Profile}
                        className={`hidden md:flex p-3 hover:bg-zinc-100 rounded items-center justify-between w-full`}
                      >
                        <div className="text-zinc-700 flex items-center gap-x-3">
                          <ProfileImage pfp={profilePicture} size="small" />
                          <span>{profile?.displayName}</span>
                        </div>
                      </Link>
                    ) : (
                      <>
                        <Link
                          to={item.destination}
                          prefetch="render"
                          key={item.page}
                          className={`px-3 py-1.5 rounded flex items-center justify-between w-full ${
                            currentLocation === item.page
                              ? "bg-zinc-100 text-black"
                              : "text-zinc-700 hover:bg-zinc-100"
                          }`}
                          onClick={() => setOpen(false)}
                        >
                          <div className="flex flex-row items-center justify-between w-full">
                            <p>{item.page}</p>
                            {item.page === NavbarPage.Notifications &&
                              unreadCount > 0 && (
                                <div className=" text-white bg-red-500 rounded-full w-6 h-6 flex gap-x-1 justify-center items-center">
                                  {/* <img
                                    src={notifBell}
                                    alt="Notifications"
                                    className="w-3 h-3"
                                    style={{ filter: "invert(1)" }}
                                  /> */}
                                  <p className="font-semibold text-xs">
                                    {unreadCount}
                                  </p>
                                </div>
                              )}
                            {item.page === NavbarPage.Tasks &&
                              todoActions > 0 && (
                                <div className=" text-white bg-green rounded-full w-6 h-6 flex gap-x-1 justify-center items-center">
                                  <p className="font-semibold text-xs">
                                    {todoActions}
                                  </p>
                                </div>
                              )}
                          </div>
                        </Link>
                      </>
                    )}
                  </>
                ))}
              </nav>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
};

export default NavbarVertical;
