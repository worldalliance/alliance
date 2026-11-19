import { Outlet } from "react-router";
import LeaveGuard from "./components/LeaveGuard";
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
    <LeaveGuard>
      <Outlet />
    </LeaveGuard>
  );
}
