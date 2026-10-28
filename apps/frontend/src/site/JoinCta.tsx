import { cn } from "@alliance/shared/styles/util";
import { SiteArrow } from "@alliance/sharedweb/ui/SiteArrow";
import { Link } from "react-router";
import { CTA_BODY } from "./content";
import { useInviteSession } from "./invite/InviteSession";
import { WAITLIST_HREF } from "./links";
import { SITE_COL } from "./ui";

const JOIN_CTA_HEADING = "Join the waitlist";
const INVITE_CTA_HEADING = "Accept invite";

const cardClass =
  "group relative isolate block w-full overflow-hidden bg-zinc-100 hover:bg-zinc-200";
const cardStyle = { borderRadius: "var(--site-radius-card)" };

function JoinCtaCard({ heading }: { heading: string }) {
  return (
    <>
      <div className="flex min-h-69 flex-col justify-end p-6 pr-16 text-zinc-900 sm:min-h-112 sm:p-10 sm:pr-20">
        <h2 className="text-4xl leading-none font-normal sm:text-5xl lg:text-6xl">
          {heading}
        </h2>
        <p className="mt-3 max-w-160 text-lg leading-snug font-normal sm:text-xl">
          {CTA_BODY}
        </p>
      </div>
      <span className="absolute right-6 bottom-6 sm:right-10 sm:bottom-9">
        <SiteArrow className="size-6 text-zinc-900 transition-transform duration-500 ease-out group-hover:translate-x-2 group-hover:-translate-y-2 group-hover:scale-110" />
      </span>
    </>
  );
}

/** Without `to`, joins through the tab's invitation when it has one. */
export function JoinCta({
  to: explicitTo,
  heading: explicitHeading,
}: {
  to?: string;
  heading?: string;
} = {}) {
  const invite = useInviteSession();
  const inviteHref = explicitTo === undefined ? invite.signupHref : null;
  const to = explicitTo ?? inviteHref ?? WAITLIST_HREF;
  const heading =
    explicitHeading ?? (inviteHref ? INVITE_CTA_HEADING : JOIN_CTA_HEADING);
  return (
    <section
      id="join"
      className="relative bg-(--site-surface) pb-16 lg:pb-24"
    >
      <div className={cn(SITE_COL, "relative")}>
        <Link
          to={to}
          aria-label={heading}
          className={cardClass}
          style={cardStyle}
        >
          <JoinCtaCard heading={heading} />
        </Link>
      </div>
    </section>
  );
}
