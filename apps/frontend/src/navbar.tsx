import { showActionInSidebarList } from "@alliance/shared/lib/actionUtils";
import { IncomingCommunityInvitesProvider } from "@alliance/shared/lib/useIncomingCommunityInvites";
import { NotificationsProvider } from "@alliance/shared/lib/useNotifications";
import { cn } from "@alliance/shared/styles/util";
import Spinner from "@alliance/sharedweb/ui/Spinner";
import { useEffect, useMemo, useState } from "react";
import { Outlet, useNavigation } from "react-router";
import NavbarTopBar from "./components/NavbarTopBar";
import NavbarVertical from "./components/NavbarVertical";
import { NavbarOptionsProvider } from "./lib/NavbarOptionsContext";
import { useTaskActionsData } from "./lib/useTaskActionsData";
import { Walkthrough } from "./onboarding/walkthrough/Walkthrough";

function Navbar() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { actions } = useTaskActionsData();

  const nTasks = useMemo(
    () => (actions ? actions.filter(showActionInSidebarList).length : 0),
    [actions],
  );

  useEffect(() => {
    const href = nTasks > 0 ? "/planet-earth-notif.png" : "/planet-earth.png";
    const existingFavicon =
      document.querySelector<HTMLLinkElement>("link[rel~='icon']");

    if (existingFavicon) {
      const hrefUrl = new URL(href, window.location.href).href;
      if (existingFavicon.href !== hrefUrl) {
        existingFavicon.href = href;
      }
      return;
    }

    const favicon = document.createElement("link");
    favicon.rel = "icon";
    favicon.type = "image/png";
    favicon.href = href;
    document.head.appendChild(favicon);
  }, [nTasks]);

  const navigation = useNavigation();
  const isNavigating = Boolean(navigation.location);

  return (
    <NavbarOptionsProvider>
      <NotificationsProvider>
        <IncomingCommunityInvitesProvider>
          <NavbarVertical
            todoActions={nTasks}
            mobileNavOpen={mobileNavOpen}
            onMobileNavOpenChange={setMobileNavOpen}
          />
          <NavbarTopBar onMenuClick={() => setMobileNavOpen((o) => !o)} />

          <main
            className={cn(
              "md:ml-[var(--nav-width)] min-h-[calc(100dvh-var(--navbar-top-bar-height))] mt-[var(--navbar-top-bar-height)] relative flex flex-col bg-page",
            )}
          >
            <div className="flex-1 relative">
              <Outlet />
            </div>
            {isNavigating && (
              <div className="fixed top-[var(--navbar-top-bar-height)] right-0 bottom-0 left-0 md:left-[var(--nav-width)] flex items-center justify-center">
                <Spinner size="large" />
              </div>
            )}
          </main>
          <Walkthrough onDrawerOpenChange={setMobileNavOpen} />
        </IncomingCommunityInvitesProvider>
      </NotificationsProvider>
    </NavbarOptionsProvider>
  );
}

export default Navbar;
