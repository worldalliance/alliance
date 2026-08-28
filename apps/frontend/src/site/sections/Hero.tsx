import { cn } from "@alliance/shared/styles/util";
import { HERO_HEADLINE, HERO_SUBHEAD } from "../content";
import { ProductPair } from "../graphics/ProductPair";
import { NAV_HEIGHT } from "../Navbar";
import { DisplayHeading, SITE_COL, SITE_H1 } from "../ui";
import { OVERLAP_CLEARANCE } from "./Priorities";

/**
 * Headline and subhead hold the left column, with the feed and an opened post
 * beside them, offset from one another rather than set in a row.
 */
export function Hero() {
  return (
    <section className="overflow-hidden bg-[var(--site-surface)]">
      <div
        className={cn(
          SITE_COL,
          "grid items-center gap-12 pb-24 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-16 lg:pb-32",
          OVERLAP_CLEARANCE,
        )}
        style={{ paddingTop: NAV_HEIGHT + 104 }}
      >
        <div className="flex flex-col gap-5">
          <DisplayHeading as="h1" className={SITE_H1}>
            {HERO_HEADLINE}
          </DisplayHeading>
          <p className="max-w-[32rem] text-lg leading-snug text-[var(--site-ink)] sm:text-[1.35rem]">
            {HERO_SUBHEAD}
          </p>
        </div>
        <ProductPair />
      </div>
    </section>
  );
}
