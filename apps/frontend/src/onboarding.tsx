// routes/root.tsx
import { Outlet } from "react-router";
import { useAuth } from "./lib/AuthContext";
import NavbarHorizontal from "./components/NavbarHorizontal";
import { geoSearchCity } from "@alliance/shared/client";

export interface OnboardingState {}

export default function AppLayout() {
  const { isAuthenticated } = useAuth();

  return (
    <>
      <Outlet />
    </>
  );
}
