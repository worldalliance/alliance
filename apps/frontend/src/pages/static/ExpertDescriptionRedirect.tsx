import { href } from "react-router";
import { redirectKeepingParams } from "./redirectKeepingParams";

export function loader({ request }: { request: Request }) {
  return redirectKeepingParams({ request, target: href("/guide") });
}

export default function ExpertDescriptionRedirect() {
  return null;
}
