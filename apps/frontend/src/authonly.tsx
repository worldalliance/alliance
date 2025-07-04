// routes/root.tsx
import { Navigate, Outlet } from "react-router";
import { useAuth } from "./lib/AuthContext";

export default function AuthOnlyLayout() {
  const { isAuthenticated, loading, user } = useAuth();

  if (!isAuthenticated && !loading) {
    return <Navigate to="/login" />;
  }

  if (!loading && isAuthenticated && user?.onboardingComplete === false) {
    return <Navigate to="/onboarding" />;
  }

  return <Outlet />;
}
