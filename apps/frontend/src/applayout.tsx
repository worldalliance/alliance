import { cn } from "@alliance/shared/styles/util";
import { isStaging } from "@alliance/sharedweb/lib/config";
import Spinner from "@alliance/sharedweb/ui/Spinner";
import { zIndex } from "@alliance/sharedweb/ui/zIndex";
import { useEffect } from "react";
import { href, Outlet, useNavigate, useNavigation } from "react-router";
import DomainMigrationModal from "./components/DomainMigrationModal";
import { useAuth } from "./lib/AuthContext";

export function HydrateFallback() {
  return (
    <div className="fixed top-[var(--navbar-top-bar-height)] right-0 bottom-0 left-0 md:left-[var(--nav-width)] flex items-center justify-center bg-page">
      <Spinner size="large" />
    </div>
  );
}

// const authOnlyRoutes = [
//   "/tasks",
//   "/settings",
//   "/profile",
//   "/onboarding",
//   "/members",
// ];

export function isAuthOnly() {
  if (window.location.pathname.includes("/actions/")) {
    return false;
  }
  return true;
}
export default function AppLayout() {
  const {
    isAuthenticated,
    loading: authLoading,
    logout,
    isImpersonation,
  } = useAuth();

  const navigate = useNavigate();
  const navigation = useNavigation();

  const isNavigating = Boolean(navigation.location);

  useEffect(() => {
    if (isAuthenticated) {
      localStorage.setItem("was-logged-in", "true");
    }

    const wasLoggedIn = localStorage.getItem("was-logged-in") === "true";

    const handleUnauthorized = () => {
      if (
        !window.location.pathname.includes("/login") &&
        !isNavigating &&
        (isAuthOnly() || wasLoggedIn)
      ) {
        console.log("unauthorized, logging out");
        logout();
        navigate(`${href("/login")}?redirect=${window.location.pathname}`);
      }
    };

    window.addEventListener("auth:unauthorized", handleUnauthorized);

    return () => {
      window.removeEventListener("auth:unauthorized", handleUnauthorized);
    };
  }, [isAuthenticated, authLoading, navigate, isNavigating, logout]);

  if (authLoading) {
    return (
      <div className="fixed top-[var(--navbar-top-bar-height)] right-0 bottom-0 left-0 md:left-[var(--nav-width)] flex items-center justify-center bg-page">
        <Spinner size="large" />
      </div>
    );
  }

  return (
    <>
      <Outlet />
      <DomainMigrationModal />
      {isStaging() && (
        <div
          className={cn(
            zIndex.nav,
            "fixed top-0 left-0 right-0 h-6 bg-green flex flex-row gap-1",
          )}
        >
          {[...Array(100)].map((_, index) => (
            <span key={index} className="text-white text-sm !font-mono">
              staging
            </span>
          ))}
        </div>
      )}
      {isImpersonation && (
        <div
          className={cn(
            zIndex.nav,
            "fixed top-0 left-0 right-0 h-6 bg-amber-500 flex flex-row gap-1",
          )}
        >
          {[...Array(100)].map((_, index) => (
            <span key={index} className="text-white text-sm !font-mono">
              impersonation
            </span>
          ))}
        </div>
      )}
    </>
  );
}
