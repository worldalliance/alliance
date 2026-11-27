import { isStaging } from "@alliance/sharedweb/lib/config";
import { useEffect } from "react";
import { Outlet } from "react-router";
import LeaveGuard from "./components/LeaveGuard";
import { useAuth } from "./lib/AuthContext";

export default function AdminLayout() {
  const { user, isAuthenticated, logout, loading } = useAuth();
  const signedOut = !isAuthenticated && !loading;
  const notAdmin = isAuthenticated && user !== undefined && !user.admin;
  useEffect(() => {
    if (signedOut || notAdmin) void logout();
  }, [signedOut, notAdmin, logout]);

  return (
    <LeaveGuard>
      <div className="flex h-screen flex-col">
        {isStaging() && (
          <p className="shrink-0 bg-success-soft py-0.5 text-center text-caption font-semibold text-success">
            Staging
          </p>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </div>
    </LeaveGuard>
  );
}
