import { cn } from "@alliance/shared/styles/util";
import { Link } from "react-router";
import { CTA_BODY } from "./content";
import { useInviteSession } from "./invite/InviteSession";
import { WAITLIST_HREF } from "./links";
import {
  SITE_BUTTON,
  SITE_BUTTON_DARK,
  SITE_BUTTON_STYLE,
  SITE_COL,
} from "./ui";

const JOIN_CTA_LABEL = "Join the waitlist";
const INVITE_CTA_LABEL = "Accept invite";

const cardStyle = { borderRadius: "var(--site-radius-card)" };

/** Without `to`, joins through the tab's invitation when it has one. */
export function JoinCta({
  to: explicitTo,
  label: explicitLabel,
}: {
  to?: string;
  label?: string;
} = {}) {
  const invite = useInviteSession();
  const inviteHref = explicitTo === undefined ? invite.signupHref : null;
  const to = explicitTo ?? inviteHref ?? WAITLIST_HREF;
  const label =
    explicitLabel ?? (inviteHref ? INVITE_CTA_LABEL : JOIN_CTA_LABEL);
  return (
    <section id="join" className="relative bg-(--site-surface) pb-16 lg:pb-24">
      <div className={cn(SITE_COL, "relative")}>
        <div
          className="flex min-h-69 flex-col items-center justify-center gap-8 bg-zinc-100 p-6 text-center text-zinc-900 sm:min-h-112 sm:p-10"
          style={cardStyle}
        >
          <h2 className="max-w-4xl text-3xl leading-tight font-normal sm:text-4xl lg:text-5xl">
            {CTA_BODY}
          </h2>
          <Link
            to={to}
            className={cn(SITE_BUTTON, SITE_BUTTON_DARK)}
            style={SITE_BUTTON_STYLE}
          >
            {label}
          </Link>
        </div>
      </div>
    </section>
  );
}
