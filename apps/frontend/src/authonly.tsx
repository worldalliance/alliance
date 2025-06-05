// routes/root.tsx
import { Navigate, Outlet } from "react-router";
import { useAuth } from "./lib/AuthContext";

export default function AuthOnlyLayout() {
  const { isAuthenticated, loading } = useAuth();

  if (!isAuthenticated && !loading) {
    return <Navigate to="/login" />;
  }

  return <Outlet />;
}
