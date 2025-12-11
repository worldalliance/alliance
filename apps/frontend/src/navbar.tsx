import { useMemo } from "react";
import { Outlet, useNavigation, useOutletContext } from "react-router";
import { AppLayoutOutletContext } from "./applayout";
import NavbarVertical from "./components/NavbarVertical";
import Spinner from "./components/Spinner";
import { NotificationsProvider } from "./lib/useNotifications";
import { canJoinAction, shouldCompleteAction } from "./pages/app/HomePage";

function Navbar() {
  const context = useOutletContext<AppLayoutOutletContext>();

  const nTasks = useMemo(
    () =>
      context.actions
        ? context.actions.filter((action) => shouldCompleteAction(action))
            .length +
          context.actions.filter((action) => canJoinAction(action)).length
        : 0,
    [context.actions]
  );

  const navigation = useNavigation();
  const isNavigating = Boolean(navigation.location);

  return (
    <NotificationsProvider>
      <NavbarVertical todoActions={nTasks} />
      <main className="min-h-[calc(100vh-var(--mobile-nav-height))] md:min-h-screen bg-page md:ml-[var(--nav-width)] mt-[var(--mobile-nav-height)] md:mt-0 relative">
        <Outlet context={context} />
        {isNavigating && (
          <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center">
            <Spinner size="large" />
          </div>
        )}
      </main>
    </NotificationsProvider>
  );
}

export default Navbar;
