import { cn } from "@alliance/shared/styles/util";
import { HERO_HEADLINE, HERO_SUBHEAD } from "../content";
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
          "flex flex-col gap-8 pt-10 pb-20",
          "lg:flex-row lg:items-end lg:gap-16 lg:pt-[104px] lg:pb-32",
        )}
      >
        <div className="flex min-w-0 flex-col gap-5 lg:flex-1">
          <DisplayHeading
            as="h1"
            className="text-[2.5rem] sm:text-6xl lg:text-[3.25rem] xl:text-[4.5rem] 2xl:text-[5.5rem]"
          >
            {HERO_HEADLINE}
          </DisplayHeading>
          <DisplaySubtitle>{HERO_SUBHEAD}</DisplaySubtitle>
        </div>
        <ProductPair className="lg:w-[46%] lg:shrink-0" />
      </div>
    </section>
  );
}
