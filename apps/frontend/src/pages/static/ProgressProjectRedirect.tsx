import { href } from "react-router";
import { redirectKeepingParams } from "./redirectKeepingParams";

export function loader({
  params,
  request,
}: {
  params: { slug: string };
  request: Request;
}) {
  return redirectKeepingParams({
    request,
    target: href("/projects/:slug", { slug: params.slug }),
  });
}

export default function ProgressProjectRedirect() {
  return null;
}
