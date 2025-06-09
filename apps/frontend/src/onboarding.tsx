// routes/root.tsx
import { Outlet } from "react-router";
import { useAuth } from "./lib/AuthContext";
import { Navigate } from "react-router";
export default function Onboarding() {
  const { isAuthenticated, user, loading } = useAuth();

  if (!isAuthenticated && !loading) {
    return <Navigate to="/login" />;
  }

  if (user?.onboardingComplete) {
    return <Navigate to="/home" />;
  }

  return (
    <>
      <Outlet />
    </>
  );
}
