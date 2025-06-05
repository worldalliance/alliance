// routes/root.tsx
import { Outlet } from "react-router";
import { useAuth } from "./lib/AuthContext";
import NavbarHorizontal from "./components/NavbarHorizontal";

export default function AppLayout() {
  const { isAuthenticated } = useAuth();

  return (
    <>
      {isAuthenticated && <NavbarHorizontal />}
      {/* All child routes render here */}
      <Outlet />
    </>
  );
}
