import { socialPreviewMeta } from "../../lib/socialPreviewMeta";
import { SiteFooter } from "../../site/Footer";
import { JoinCta } from "../../site/JoinCta";
import { Navbar } from "../../site/Navbar";
import { SiteRoot } from "../../site/PageShell";
import { Hero } from "../../site/sections/Hero";
import { LandingBody } from "../../site/sections/LandingBody";

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
    <SiteRoot>
      <Navbar />
      <Hero />
      <LandingBody />
      <JoinCta />
      <SiteFooter />
    </SiteRoot>
  );
}
