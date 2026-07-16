import { cn } from "@alliance/shared/styles/util";
import { isStaging } from "@alliance/sharedweb/lib/config";
import { zIndex } from "@alliance/sharedweb/ui/zIndex";
import { Outlet } from "react-router";
import { useAuth } from "./lib/AuthContext";

export default function AdminLayout() {
  const { user, isAuthenticated, logout, loading } = useAuth();
  if (
    (isAuthenticated && user && !user.admin) ||
    (!isAuthenticated && !loading)
  ) {
    logout();
  }

  return (
    <>
      <Outlet />
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
    </>
  );
}
