import { redirect } from "react-router";
import {
  LINK_PARAM,
  REFERRER_PARAM,
} from "../../components/projects/democratic-grantmaking-26/useWaitlist";
import { WAITLIST_HREF } from "../../site/links";

export function loader({ request }: { request: Request }) {
  const incoming = new URL(request.url).searchParams;
  const kept = new URLSearchParams();
  for (const param of [LINK_PARAM, REFERRER_PARAM]) {
    const value = incoming.get(param);
    if (value !== null) kept.set(param, value);
  }
  const query = kept.toString();
  return redirect(query ? `${WAITLIST_HREF}?${query}` : WAITLIST_HREF);
}

export default function JoinRedirect() {
  return null;
}
