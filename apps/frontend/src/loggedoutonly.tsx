import { Navigate, Outlet } from "react-router";
import { useAuth } from "./lib/AuthContext";

export default function AuthOnlyLayout() {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) {
    return <Navigate to="/home" />;
  }

  return <Outlet />;
}
