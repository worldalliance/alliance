import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import { useAuth } from "../lib/AuthContext";
import { MmsThreadsLiveProvider } from "../lib/mmsThreadsLive";
import { AREAS } from "../places";
import Palette from "./Palette";
import {
  type Shortcut,
  ShortcutsProvider,
  useOpenShortcutList,
  useShortcut,
  useSingleKeysOn,
} from "./shortcuts";
import Sidebar from "./Sidebar";
import { useQueueCounts } from "./useQueueCounts";
import { useSidebarExpanded } from "./useSidebarExpanded";

function Bind({ shortcut }: { shortcut: Shortcut }) {
  useShortcut(shortcut);
  return null;
}

/** `g` then an area's letter goes to that area's first page. */
function AreaShortcuts() {
  const navigate = useNavigate();
  return AREAS.map((area) => (
    <Bind
      key={area.id}
      shortcut={{
        keys: `g ${area.key}`,
        label: `Go to ${area.label}`,
        global: true,
        run: () => void navigate(area.places[0].path),
      }}
    />
  ));
}

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
  const openShortcutList = useOpenShortcutList();
  useShortcut({
    keys: "[",
    label: "Collapse or expand the sidebar",
    global: true,
    run: toggleSidebar,
  });
  useShortcut({
    keys: "?",
    label: "Show keyboard shortcuts",
    global: true,
    run: openShortcutList,
  });

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
        onOpenShortcuts={openShortcutList}
        singleKeysOn={useSingleKeysOn()}
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
      <Palette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        counts={counts}
      />
      <AreaShortcuts />
    </div>
  );
}

export default function ShellLayout() {
  return (
    <MmsThreadsLiveProvider>
      <ShortcutsProvider>
        <Shell />
      </ShortcutsProvider>
    </MmsThreadsLiveProvider>
  );
}
