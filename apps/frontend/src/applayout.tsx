// routes/root.tsx
import { Navigate, Outlet } from "react-router";
import { useAuth } from "./lib/AuthContext";
import NavbarHorizontal from "./components/NavbarHorizontal";
import { useEffect, useState } from "react";

export default function AppLayout() {
  const { isAuthenticated, loading } = useAuth();

  const [shouldGoToLogin, setShouldGoToLogin] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      localStorage.setItem("was-logged-in", "true");
    }
    // prevent user from going into "logged out mode" if their session expires
    if (
      !isAuthenticated &&
      localStorage.getItem("was-logged-in") === "true" &&
      !loading
    ) {
      setShouldGoToLogin(true);
    }
  }, [isAuthenticated]);

  if (shouldGoToLogin) {
    return <Navigate to="/login" />;
  }

  return (
    <>
      {isAuthenticated && <NavbarHorizontal />}
      {/* All child routes render here */}
      <Outlet />
    </>
  );
}
