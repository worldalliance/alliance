import { TRACKING_PARAM } from "@alliance/common/linkOpening";
import { redirect } from "react-router";

/**
 * Redirects to `target` with the request's `keep` parameters, and a tracked
 * link's ID for that page to record.
 */
export function redirectKeepingParams({
  request,
  target,
  keep = [],
}: {
  request: Request;
  target: string;
  keep?: string[];
}): Response {
  const incoming = new URL(request.url).searchParams;
  const kept = new URLSearchParams();
  for (const param of [...keep, TRACKING_PARAM]) {
    const value = incoming.get(param);
    if (value !== null) kept.set(param, value);
  }
  const query = kept.toString();
  return redirect(query ? `${target}?${query}` : target);
}
