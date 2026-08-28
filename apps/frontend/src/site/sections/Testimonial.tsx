import { cn } from "@alliance/shared/styles/util";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import { HOME_TESTIMONIAL } from "../content";
import { usePublicProfile } from "../data";
import { QuoteMark, QuoteMarkKind, SITE_COL } from "../ui";

/**
 * Marks bracket the column, opening low-left and closing beside the last line
 * of the quote rather than hanging below the attribution.
 */
export function Testimonial() {
  const { data: profile } = usePublicProfile(HOME_TESTIMONIAL.memberId);

  return (
    <section className="bg-[var(--site-surface)] pt-10 pb-24 lg:pt-10 lg:pb-32">
      <div className={SITE_COL}>
        <figure className="relative mx-auto flex max-w-[600px] flex-col gap-5">
          <QuoteMark
            kind={QuoteMarkKind.Open}
            flipped
            className="absolute -top-8 -left-[118px] hidden w-[90px] text-[var(--site-ink)]/[0.11] lg:block"
          />
          <div className="relative">
            <blockquote className="text-[1.1rem] leading-[1.55] font-normal text-[var(--site-ink)] sm:text-[1.33rem]">
              {HOME_TESTIMONIAL.quoteLead}
              <strong className="font-semibold">
                {HOME_TESTIMONIAL.quoteEmphasis}
              </strong>
            </blockquote>
            <QuoteMark
              kind={QuoteMarkKind.Close}
              className="absolute -right-[118px] -bottom-10 hidden w-[90px] text-[var(--site-ink)]/[0.11] lg:block"
            />
          </div>
          <figcaption className="flex items-center gap-2.5">
            <AvatarProfile
              pfp={profile?.profilePicture ?? null}
              size="override"
              alt=""
              className={cn("size-9 rounded-[5px]")}
            />
            <span className="text-left leading-tight">
              <span className="block text-[0.85rem] font-semibold text-[var(--site-ink)]">
                {profile?.displayName ?? ""}
              </span>
              <span className="block text-[0.8rem] text-[var(--site-ink)]/55">
                {HOME_TESTIMONIAL.role}
              </span>
            </span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
