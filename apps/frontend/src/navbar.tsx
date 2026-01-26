import { useEffect, useMemo } from "react";
import { Outlet, useNavigation, useOutletContext } from "react-router";
import { AppLayoutOutletContext } from "./applayout";
import NavbarVertical from "./components/NavbarVertical";
import Spinner from "@alliance/sharedweb/ui/Spinner";
import { NotificationsProvider } from "@alliance/shared/lib/useNotifications";
import { showActionInSidebarList } from "@alliance/shared/lib/actionUtils";
import { IncomingCommunityInvitesProvider } from "@alliance/shared/lib/useIncomingCommunityInvites";

function Navbar() {
  const context = useOutletContext<AppLayoutOutletContext>();

  const nTasks = useMemo(
    () =>
      context.actions
        ? context.actions.filter(showActionInSidebarList).length
        : 0,
    [context.actions]
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
    <NotificationsProvider>
      <IncomingCommunityInvitesProvider>
        <NavbarVertical todoActions={nTasks} />
        <main className="min-h-[calc(100dvh-var(--mobile-nav-height))] md:min-h-screen bg-page md:ml-[var(--nav-width)] mt-[var(--mobile-nav-height)] md:mt-0 relative">
          <Outlet context={context} />
          {isNavigating && (
            <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center">
              <Spinner size="large" />
            </div>
          )}
        </main>
      </IncomingCommunityInvitesProvider>
    </NotificationsProvider>
  );
}

export default Navbar;
