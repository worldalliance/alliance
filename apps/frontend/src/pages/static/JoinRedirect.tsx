import {
  WAITLIST_LINK_PARAM,
  WAITLIST_REFERRER_PARAM,
} from "@alliance/common/waitlist";
import { WAITLIST_HREF } from "../../site/links";
import { redirectKeepingParams } from "./redirectKeepingParams";

export function loader({ request }: { request: Request }) {
  return redirectKeepingParams({
    request,
    target: WAITLIST_HREF,
    keep: [WAITLIST_LINK_PARAM, WAITLIST_REFERRER_PARAM],
  });
}

export default function JoinRedirect() {
  return null;
}
