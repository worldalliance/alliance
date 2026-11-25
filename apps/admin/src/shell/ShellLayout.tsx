import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router";
import AdminSearch from "../components/AdminSearch";
import { useAuth } from "../lib/AuthContext";
import { MmsThreadsLiveProvider } from "../lib/mmsThreadsLive";
import Sidebar from "./Sidebar";
import { useQueueCounts } from "./useQueueCounts";
import { useSidebarExpanded } from "./useSidebarExpanded";

/**
 * The frame every signed-in page renders in: the sidebar and one scrolling
 * main region. It has no header of its own; a page brings its own.
 */
function Shell() {
  const [expanded, toggleSidebar] = useSidebarExpanded();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const counts = useQueueCounts();

  // The main region scrolls, not the window, so the router can't reset it.
  useEffect(() => {
    mainRef.current?.scrollTo?.(0, 0);
  }, [pathname]);

  return (
    <div className="flex h-full">
      <a
        href="#main"
        className="sr-only rounded-md bg-surface px-3 py-2 font-medium text-fg shadow-pop focus-ring focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-20"
      >
        Skip to content
      </a>
      <Sidebar
        expanded={expanded}
        onToggle={toggleSidebar}
        onOpenPalette={() => setPaletteOpen(true)}
        counts={counts}
        user={user}
        onSignOut={() => void logout()}
      />
      <main
        id="main"
        ref={mainRef}
        tabIndex={-1}
        className="min-w-0 flex-1 overflow-y-auto outline-none"
      >
        <div className="flex min-h-full flex-col gap-y-5">
          <Outlet />
        </div>
      </main>
      <AdminSearch open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}

export default function ShellLayout() {
  return (
    <MmsThreadsLiveProvider>
      <Shell />
    </MmsThreadsLiveProvider>
  );
}
