import {
  activityById,
  activityRows,
  HERO_SUBHEAD_PARTS,
  type ActivityRow,
} from "../content";
import { LINK_BLUE, type RedesignTheme } from "../theme";
import { RdButton } from "../ui";
import { PostCard, ScaledCard } from "./PostCard";

const FEED_TITLE = "Activity";

const DETAIL_TITLE = "Action update";

const DETAIL_ITEM = "chatbot-transcripts";

const FEED_WIDTH = 380;
const FEED_HEIGHT = 255;
const DETAIL_WIDTH = 400;
const DETAIL_HEIGHT = 300;
const CARD_SCALE = 0.86;

function CardTitleBar({ children }: { children: string }) {
  return (
    <div className="shrink-0 bg-[var(--rd-surface-alt)] px-4 py-2.5 text-[13px] font-semibold text-[var(--rd-ink)]">
      {children}
    </div>
  );
}

/** Four faces butted together in one rounded strip, as the reference shows. */
function AvatarStrip({ avatars }: { avatars: string[] }) {
  return (
    <span
      className="mt-0.5 flex h-[19px] shrink-0 overflow-hidden rounded-[4px] border border-[var(--rd-ink)]/20"
      aria-hidden
    >
      {avatars.map((src, i) => (
        <img
          key={`${src}-${i}`}
          src={src}
          alt=""
          className="h-full w-[17px] object-cover"
        />
      ))}
    </span>
  );
}

/**
 * One line of activity, set as a sentence: bold subject, plain verb, then the
 * action in the link blue, and how long ago it closed.
 */
function ActivityLine({ row }: { row: ActivityRow }) {
  return (
    <li className="flex items-start gap-2.5 px-4">
      <AvatarStrip avatars={row.avatars} />
      <p className="text-[13px] leading-[1.45] text-[var(--rd-ink)]">
        <span className="font-semibold">{row.subject}</span> {row.verb}
        {row.action && (
          <>
            {" "}
            <span className="font-semibold" style={{ color: LINK_BLUE }}>
              {row.action}
            </span>
          </>
        )}
        {row.timeAgo && ` ${row.timeAgo}`}
      </p>
    </li>
  );
}

/** The member feed, as it looks inside the product. */
function FeedCard() {
  return (
    <div
      className="flex h-full flex-col overflow-hidden bg-white shadow-[0_18px_45px_-20px_rgba(4,14,32,0.55)]"
      style={{ borderRadius: "var(--rd-radius-card)" }}
    >
      <CardTitleBar>{FEED_TITLE}</CardTitleBar>
      <ul
        className="flex min-h-0 flex-1 flex-col gap-4 py-4"
        style={{
          maskImage: "linear-gradient(to bottom, #000 90%, transparent 100%)",
        }}
      >
        {activityRows.map((row) => (
          <ActivityLine key={row.id} row={row} />
        ))}
      </ul>
    </div>
  );
}

/** A single post opened from the feed, so the pair reads as one product. */
function PostDetailCard() {
  return (
    <div
      className="flex h-full flex-col overflow-hidden bg-white shadow-[0_18px_45px_-20px_rgba(4,14,32,0.55)]"
      style={{ borderRadius: "var(--rd-radius-card)" }}
    >
      <CardTitleBar>{DETAIL_TITLE}</CardTitleBar>
      <div className="min-h-0 flex-1">
        <PostCard
          item={activityById(DETAIL_ITEM)}
          className="border-0 shadow-none"
        />
      </div>
    </div>
  );
}

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
