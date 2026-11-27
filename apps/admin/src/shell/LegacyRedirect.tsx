import { Navigate, useLocation } from "react-router";
import { legacyRedirect } from "../legacyRoutes";

/** The route behind every old URL: sends it to where that page lives now. */
export default function LegacyRedirect() {
  const target = legacyRedirect(useLocation());
  if (!target) throw new Error("no redirect for this old URL");
  return <Navigate to={target} replace />;
}
