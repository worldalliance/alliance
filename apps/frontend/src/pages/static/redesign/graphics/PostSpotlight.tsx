import { HERO_SUBHEAD_PARTS } from "../content";
import type { RedesignTheme } from "../theme";
import { RdButton } from "../ui";
import { ScaledCard } from "./PostCard";
import {
  DETAIL_HEIGHT,
  DETAIL_WIDTH,
  FEED_HEIGHT,
  FEED_WIDTH,
  FeedCard,
  PostDetailCard,
} from "./ProductScreens";

const CARD_SCALE = 0.86;

/**
 * Landing 7. The supporting copy sits on a panel cut into the hero band, with
 * a feed card overlapping one corner and an opened post the other, so the two
 * frame the sentence between them.
 */
export function PostSpotlight({ theme }: { theme: RedesignTheme }) {
  return (
    // Bottom padding leaves room for the opened post to hang past the panel.
    <div className="relative lg:pb-24">
      <div className="mx-auto w-full max-w-[820px]">
        <div
          className="group relative flex flex-col items-center justify-center gap-6 bg-[var(--rd-surface)] px-6 py-14 text-center sm:py-20"
          style={{ borderRadius: "var(--rd-radius-card)" }}
        >
          {/* The inset stroke the closing CTA draws on hover. */}
          <div
            className="pointer-events-none absolute inset-3 border border-[var(--rd-accent)]/0 transition-colors duration-500 group-hover:border-[var(--rd-accent)]"
            style={{ borderRadius: "var(--rd-radius-card)" }}
            aria-hidden
          />
          <p className="max-w-[26rem] text-[1.35rem] leading-snug text-[var(--rd-ink)] sm:text-[1.5rem]">
            {HERO_SUBHEAD_PARTS.lead}
            <span className="font-semibold">{HERO_SUBHEAD_PARTS.emphasis}</span>
            {HERO_SUBHEAD_PARTS.tail}
          </p>
          <RdButton href="#join" size="sm">
            {theme.joinLabel}
          </RdButton>
        </div>
      </div>

      {/* Flush with the page margins, so they line up with the priority row. */}
      <ScaledCard
        width={FEED_WIDTH}
        height={FEED_HEIGHT}
        scale={CARD_SCALE}
        className="absolute top-[-56px] left-0 hidden lg:block"
      >
        <FeedCard />
      </ScaledCard>
      <ScaledCard
        width={DETAIL_WIDTH}
        height={DETAIL_HEIGHT}
        scale={CARD_SCALE}
        className="absolute right-0 bottom-0 hidden lg:block"
      >
        <PostDetailCard />
      </ScaledCard>

      {/* Too little room to flank the panel below lg, so one card sits under it. */}
      <ScaledCard
        width={FEED_WIDTH}
        height={FEED_HEIGHT}
        scale={0.78}
        className="mx-auto mt-8 lg:hidden"
      >
        <FeedCard />
      </ScaledCard>
    </div>
  );
}
