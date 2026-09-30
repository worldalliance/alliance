import {
  WAITLIST_LINK_PARAM,
  WAITLIST_REFERRER_PARAM,
} from "@alliance/common/waitlist";
import { redirect } from "react-router";
import { WAITLIST_HREF } from "../../site/links";

export function loader({ request }: { request: Request }) {
  const incoming = new URL(request.url).searchParams;
  const kept = new URLSearchParams();
  for (const param of [WAITLIST_LINK_PARAM, WAITLIST_REFERRER_PARAM]) {
    const value = incoming.get(param);
    if (value !== null) kept.set(param, value);
  }
  const query = kept.toString();
  return redirect(query ? `${WAITLIST_HREF}?${query}` : WAITLIST_HREF);
}

export default function JoinRedirect() {
  return null;
}
