import {
  NAV_BAR_CONTAINER_HEIGHT,
  NAV_BAR_ICON_HEIGHT,
} from "@alliance/shared/lib/constants";
import { cn } from "@alliance/shared/styles/util";
import { useOutsideClick } from "@alliance/sharedweb/lib/useOutsideClick";
import { Menu, Search, X } from "lucide-react";
import {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useAuth } from "../lib/AuthContext";
import { NavbarOptionsContext } from "../lib/NavbarOptionsContext";
import NotificationsIcon from "./NotificationsIcon";
import ProfileDropdown from "./ProfileDropdown";
import SearchBar from "./SearchBar";

export function NavbarTopBar({
  onMenuClick,
  className,
  whiteBackground: whiteBackgroundProp,
}: {
  onMenuClick?: () => void;
  className?: string;
  whiteBackground?: boolean;
}) {
  const navbarOptions = useContext(NavbarOptionsContext);
  const whiteBackground =
    whiteBackgroundProp ?? navbarOptions?.options?.whiteBackground ?? false;
  const { isAuthenticated } = useAuth();
  const [searchExpanded, setSearchExpanded] = useState(false);
  const searchContainerRef = useOutsideClick(() => setSearchExpanded(false));
  const navbarTopBarRef = useRef<HTMLDivElement | null>(null);

  const updateNavbarTopBarHeight = useCallback(() => {
    if (navbarTopBarRef.current) {
      document.documentElement.style.setProperty(
        "--navbar-top-bar-height",
        `${navbarTopBarRef.current.offsetHeight}px`,
      );
    }
  }, []);

  useLayoutEffect(() => {
    updateNavbarTopBarHeight();

    const handleResize = () => {
      updateNavbarTopBarHeight();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [updateNavbarTopBarHeight, searchExpanded]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    if (!isAuthenticated) {
      document.documentElement.style.setProperty(
        "--navbar-top-bar-height",
        "0px",
      );
      return;
    }

    if (
      document.documentElement.style.getPropertyValue(
        "--navbar-top-bar-height",
      ) === "0px"
    ) {
      requestAnimationFrame(() => {
        updateNavbarTopBarHeight();
      });
    }
  }, [isAuthenticated, updateNavbarTopBarHeight]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchExpanded(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <header
      className={cn(
        "z-20 flex items-center justify-between gap-2.5 px-3 py-2 md:px-4",
        whiteBackground ? "bg-white" : "bg-page",
        "fixed top-0 left-0 right-0 md:left-[var(--nav-width)]",
        className,
      )}
      ref={navbarTopBarRef}
    >
      {/* Menu button - mobile only */}
      {onMenuClick && (
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 -ml-1 rounded-md hover:bg-zinc-100 focus:outline-none"
          aria-label="Toggle navigation"
        >
          <Menu size={24} />
        </button>
      )}
      <div className="flex-1 flex justify-end items-center gap-2">
        {/* Search: icon that expands to search bar */}
        <div
          ref={searchContainerRef}
          className={cn(
            "flex items-center",
            searchExpanded ? "flex-1 min-w-0 max-w-md" : "shrink-0",
          )}
        >
          {searchExpanded ? (
            <div className="flex items-center w-full rounded-md bg-white overflow-visible">
              <Search
                size={NAV_BAR_ICON_HEIGHT}
                className="shrink-0 ml-3 text-zinc-500"
                aria-hidden
              />
              <SearchBar
                autofocus
                onCollapse={() => setSearchExpanded(false)}
                inputClassName={cn(
                  "border-0 rounded-none flex-1 min-w-0 focus:ring-0 pl-2 pr-1",
                  "bg-white",
                )}
                containerClassName={`h-${NAV_BAR_CONTAINER_HEIGHT}`}
              />
              <button
                onClick={() => setSearchExpanded(false)}
                className={cn(
                  "shrink-0 rounded hover:bg-grey-1 focus:outline-none text-zinc-500 px-2",
                  `h-${NAV_BAR_CONTAINER_HEIGHT}`,
                )}
                aria-label="Close search"
              >
                <X size={NAV_BAR_ICON_HEIGHT} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setSearchExpanded(true)}
              className={cn(
                "bg-grey-2 hover:bg-grey-3 focus:outline-none rounded-full flex items-center justify-center",
                `h-${NAV_BAR_CONTAINER_HEIGHT} w-${NAV_BAR_CONTAINER_HEIGHT}`,
              )}
              aria-label="Search"
            >
              <Search size={NAV_BAR_ICON_HEIGHT} />
            </button>
          )}
        </div>

        <div className="relative">
          <NotificationsIcon />
        </div>
        <div className="relative">
          <ProfileDropdown />
        </div>
      </div>
    </header>
  );
}

export default NavbarTopBar;
