import { socialPreviewMeta } from "../../lib/socialPreviewMeta";
import { SiteFooter } from "../../site/Footer";
import { JoinCta } from "../../site/JoinCta";
import { Navbar } from "../../site/Navbar";
import { SiteRoot } from "../../site/PageShell";
import { Hero } from "../../site/sections/Hero";
import { HowItWorks } from "../../site/sections/HowItWorks";
import { ModelSection } from "../../site/sections/ModelSection";
import { Priorities } from "../../site/sections/Priorities";
import { Testimonial } from "../../site/sections/Testimonial";

export function meta() {
  return socialPreviewMeta({
    title:
      "The Alliance — A global group of people cooperating to improve the world",
    description:
      "A global group of people cooperating to improve the world. Members spend 15 minutes a week completing thoughtfully designed actions for measurable impact.",
    image: "/og-home.png",
    url: "/",
  });
}

export default function PrelaunchLandingPage() {
  return (
    <SiteRoot>
      <Navbar />
      <Hero />
      <Priorities />
      <HowItWorks />
      <ModelSection />
      <Testimonial />
      <JoinCta />
      <SiteFooter />
    </SiteRoot>
  );
}
