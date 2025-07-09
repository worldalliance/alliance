import { Navigate, Outlet } from "react-router";
import { useAuth } from "./lib/AuthContext";
import NavbarHorizontal from "./components/NavbarHorizontal";
import { useEffect, useState } from "react";
import { actionsFindAllWithStatus } from "@alliance/shared/client";
import { ActionDto } from "@alliance/shared/client";
import { Route } from "../.react-router/types/src/+types/applayout";

export interface RouteMatch {
  data: unknown;
  id: string;
}

export interface RouteMatches {
  matches: RouteMatch[];
}

export async function clientLoader({}: Route.LoaderArgs): Promise<ActionDto[]> {
  const actions = await actionsFindAllWithStatus();
  return actions.data || [];
}

export function getActionDataFromMatches(
  matches: RouteMatch[]
): Awaited<ReturnType<typeof clientLoader>> {
  const actions = matches.filter((x) => x.id === "applayout")[0]!
    .data as Awaited<ReturnType<typeof clientLoader>>;
  return actions;
}

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
  }, [isAuthenticated, loading]);

  if (shouldGoToLogin) {
    return <Navigate to="/login" />;
  }

  return (
    <>
      {isAuthenticated && <NavbarHorizontal />}
      <Outlet />
    </>
  );
}
