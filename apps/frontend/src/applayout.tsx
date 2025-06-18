// routes/root.tsx
import { Navigate, Outlet } from "react-router";
import { useAuth } from "./lib/AuthContext";
import NavbarHorizontal from "./components/NavbarHorizontal";
import { useEffect } from "react";

export default function AppLayout() {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      localStorage.setItem("was-logged-in", "true");
    }
  }, [isAuthenticated]);

  // prevent user from going into "logged out mode" if their session expires
  if (!isAuthenticated && localStorage.getItem("was-logged-in") === "true") {
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
