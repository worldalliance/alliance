import { cn } from "@alliance/shared/styles/util";
import { HERO_HEADLINE_PARTS, HERO_SUBHEAD } from "../content";
import { ProductPair } from "../graphics/ProductPair";
import { NAV_HEIGHT } from "../Navbar";
import { DisplayHeading, DisplaySubtitle, SITE_COL } from "../ui";

/**
 * Headline and subhead hold the left column, with the feed and an opened post
 * beside them, offset from one another rather than set in a row. Below lg the
 * pair drops under the copy so the headline can use the full width.
 */
export function Hero() {
  return (
    <section
      className="overflow-hidden bg-[var(--site-surface)]"
      style={{ paddingTop: NAV_HEIGHT }}
    >
      <div
        className={cn(
          SITE_COL,
          "flex flex-col gap-8 pt-10 pb-32",
          "min-[1020px]:flex-row min-[1020px]:items-start min-[1020px]:gap-16 min-[1020px]:pt-[104px]",
        )}
      >
        <div className="flex min-w-0 flex-col gap-5 min-[1020px]:flex-1 min-[1020px]:self-end">
          <DisplayHeading
            as="h1"
            leading={1.15}
            className="text-[clamp(2.5rem,7.5vw,3.75rem)] min-[1020px]:text-[clamp(3.25rem,4.7vw,5.25rem)]"
          >
            {HERO_HEADLINE_PARTS.lead}{" "}
            <span className="site-display whitespace-nowrap">
              {HERO_HEADLINE_PARTS.tail}
            </span>
          </DisplayHeading>
          <DisplaySubtitle>{HERO_SUBHEAD}</DisplaySubtitle>
        </div>
        <ProductPair className="min-[1020px]:w-[46%] min-[1020px]:shrink-0" />
      </div>
    </section>
  );
}
