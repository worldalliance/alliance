import { Link } from "react-router";
import { socialPreviewMeta } from "../../lib/socialPreviewMeta";
import { SiteFooter } from "../../site/Footer";
import { JoinCta } from "../../site/JoinCta";
import { WAITLIST_HREF } from "../../site/links";
import { Navbar } from "../../site/Navbar";
import { SiteRoot } from "../../site/PageShell";
import { Hero } from "../../site/sections/Hero";
import { LandingBody } from "../../site/sections/LandingBody";
import { SiteArrow } from "../../site/ui";

export function meta() {
  return socialPreviewMeta({
    title:
      "The Alliance — A global group of people cooperating to improve the world",
    description:
      "A global group of people cooperating to improve the world. Members spend 15 minutes a week completing thoughtfully designed actions for measurable impact.",
    url: "/",
  });
}

export default function PrelaunchLandingPage() {
  return (
    <SiteRoot className="pt-12 sm:pt-10">
      <Navbar
        announcement={
          <Link
            to={WAITLIST_HREF}
            className="flex h-12 items-center justify-center gap-3 bg-[var(--site-primary)] px-5 text-center text-sm font-medium text-white hover:bg-[var(--site-primary-hover)] sm:h-10"
          >
            <span>Help decide where $100k goes.</span>
            <SiteArrow className="size-2.5 shrink-0" />
          </Link>
        }
      />
      <Hero />
      <LandingBody />
      <JoinCta />
      <SiteFooter />
    </SiteRoot>
  );
}
