import { cn } from "@alliance/shared/styles/util";
import membersPhoto from "../assets/redesign/members-photo.webp";
import { CONTACT_EMAIL, CTA_BODY, CTA_BUTTON } from "./content";
import { SITE_COL, SiteArrow, TexturedFill } from "./ui";

/** How far the artwork hangs over the footer, measured off the Figma. */
const FOOTER_OVERLAP = 54;

export function JoinCta() {
  return (
    <section id="join" className="relative bg-[var(--site-surface)]">
      <div
        className="absolute inset-x-0 bottom-0 overflow-hidden bg-[var(--site-primary)]"
        style={{ height: FOOTER_OVERLAP }}
        aria-hidden
      >
        <TexturedFill />
      </div>
      <div className={cn(SITE_COL, "relative")}>
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          aria-label={CTA_BUTTON}
          className="group relative isolate block w-full overflow-hidden"
          style={{ borderRadius: "var(--site-radius-card)" }}
        >
          <img
            src={membersPhoto}
            alt="Alliance members at a meetup"
            className="absolute inset-0 -z-20 size-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.06]"
          />
          <div
            className="absolute inset-0 -z-10 bg-[var(--site-primary)] opacity-[0.42] transition-opacity duration-700 group-hover:opacity-[0.28]"
            aria-hidden
          />
          <div className="flex min-h-[260px] flex-col justify-end p-6 pr-16 text-white sm:min-h-[420px] sm:p-10 sm:pr-20">
            <h2 className="text-[2.25rem] leading-none font-normal sm:text-[3.1rem] lg:text-[3.6rem]">
              Request to join
            </h2>
            <p className="mt-3 max-w-[40rem] text-lg leading-snug font-light sm:text-[1.35rem]">
              {CTA_BODY}
            </p>
          </div>
          <span className="absolute right-6 bottom-6 sm:right-10 sm:bottom-9">
            <SiteArrow className="size-6 text-white transition-transform duration-500 ease-out group-hover:translate-x-2 group-hover:-translate-y-2 group-hover:scale-110" />
          </span>
        </a>
      </div>
    </section>
  );
}
