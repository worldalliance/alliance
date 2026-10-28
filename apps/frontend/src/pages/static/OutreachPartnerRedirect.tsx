import { href } from "react-router";
import { redirectKeepingParams } from "./redirectKeepingParams";

export function loader({ request }: { request: Request }) {
  return redirectKeepingParams({ request, target: href("/partner") });
}

export default function OutreachPartnerRedirect() {
  return null;
}
