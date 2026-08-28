import { activityRows, openedPost, type ActivityRow } from "../content";
import { pickFaces, useMemberFaces, useUpdateAuthor } from "../data";
import { LINK_BLUE } from "../tokens";
import { PostCard } from "./PostCard";

const FEED_TITLE = "Activity";
const DETAIL_TITLE = "Action update";

/** Both cards are laid out at these sizes and scaled down where they're used. */
export const FEED_WIDTH = 380;
export const FEED_HEIGHT = 255;
export const DETAIL_WIDTH = 400;
export const DETAIL_HEIGHT = 300;

/** How many faces one row's strip shows. */
const STRIP_FACES = 4;

function CardTitleBar({ children }: { children: string }) {
  return (
    <div className="shrink-0 bg-[var(--site-surface-alt)] px-4 py-2.5 text-[13px] font-semibold text-[var(--site-ink)]">
      {children}
    </div>
  );
}

/** Four faces butted together in one rounded strip, as the reference shows. */
function AvatarStrip({ avatars }: { avatars: string[] }) {
  return (
    <span
      className="mt-0.5 flex h-[19px] shrink-0 overflow-hidden rounded-[4px] border border-[var(--site-ink)]/20"
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
function ActivityLine({
  row,
  avatars,
}: {
  row: ActivityRow;
  avatars: string[];
}) {
  return (
    <li className="flex items-start gap-2.5 px-4">
      <AvatarStrip avatars={avatars} />
      <p className="text-[13px] leading-[1.45] text-[var(--site-ink)]">
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
export function FeedCard() {
  const faces = useMemberFaces();

  return (
    <div
      className="flex h-full flex-col overflow-hidden bg-white shadow-[0_18px_45px_-20px_rgba(4,14,32,0.55)]"
      style={{ borderRadius: "var(--site-radius-card)" }}
    >
      <CardTitleBar>{FEED_TITLE}</CardTitleBar>
      <ul
        className="flex min-h-0 flex-1 flex-col gap-4 py-4"
        style={{
          maskImage: "linear-gradient(to bottom, #000 90%, transparent 100%)",
        }}
      >
        {activityRows.map((row, index) => (
          <ActivityLine
            key={row.id}
            row={row}
            avatars={pickFaces(faces, STRIP_FACES, index * STRIP_FACES)}
          />
        ))}
      </ul>
    </div>
  );
}

/** A single post opened from the feed, so the pair reads as one product. */
export function PostDetailCard() {
  const author = useUpdateAuthor();

  return (
    <div
      className="flex h-full flex-col overflow-hidden bg-white shadow-[0_18px_45px_-20px_rgba(4,14,32,0.55)]"
      style={{ borderRadius: "var(--site-radius-card)" }}
    >
      <CardTitleBar>{DETAIL_TITLE}</CardTitleBar>
      <div className="min-h-0 flex-1">
        <PostCard
          post={openedPost}
          author={author}
          className="border-0 shadow-none"
        />
      </div>
    </div>
  );
}
