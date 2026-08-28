import { cn } from "@alliance/shared/styles/util";
import type { CSSProperties, ReactNode } from "react";
import { PostBlockKind, type PostBlock, type PostUpdate } from "../content";
import type { SiteAuthor } from "../data";

function Block({ block }: { block: PostBlock }) {
  switch (block.kind) {
    case PostBlockKind.Paragraph:
      return (
        <p className="text-[13px] leading-[1.45] text-[var(--site-ink)]/80">
          {block.lead && (
            <span className="font-semibold text-[var(--site-ink)]">
              {block.lead}{" "}
            </span>
          )}
          {block.text}
        </p>
      );
    case PostBlockKind.Heading:
      return (
        <h3 className="text-[13px] font-semibold text-[var(--site-ink)]">
          {block.text}
        </h3>
      );
    case PostBlockKind.List:
      return (
        <ul className="flex flex-col gap-1.5 pl-4 text-[12.5px] leading-[1.45] text-[var(--site-ink)]/80">
          {block.items.map((item) => (
            <li
              key={item.lead}
              className="list-disc marker:text-[var(--site-ink)]/40"
            >
              <span className="font-semibold text-[var(--site-ink)]">
                {item.lead}
              </span>{" "}
              {item.text}
            </li>
          ))}
        </ul>
      );
    default:
      throw new Error(`unknown post block: ${block satisfies never}`);
  }
}

/**
 * A published outcome as it appears in the feed: the headline and the action it
 * came from on white, then the write-up on an inset tinted panel headed by
 * whoever in the office wrote it. Longer bodies run past the frame and fade at
 * its foot.
 */
export function PostCard({
  post,
  author,
  className,
}: {
  post: PostUpdate;
  author?: SiteAuthor;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full flex-col overflow-hidden bg-white",
        "border border-[var(--site-ink)]/12 shadow-[0_10px_30px_-18px_rgba(0,0,0,0.4)]",
        className,
      )}
      style={{ borderRadius: "var(--site-radius-card)" }}
    >
      <header className="flex flex-col gap-1 px-4 pt-3.5 pb-3">
        <p className="flex items-baseline gap-2">
          <span className="text-[14px] leading-tight font-semibold text-[var(--site-ink)]">
            {post.title}
          </span>
          <span className="shrink-0 text-[11.5px] text-[var(--site-ink)]/45">
            {post.timeAgo}
          </span>
        </p>
        <span className="text-[12.5px] leading-tight text-[var(--site-link)] underline">
          {post.actionLabel}
        </span>
      </header>
      <div
        className="mx-4 flex min-h-0 flex-1 flex-col gap-2.5 bg-[var(--site-ink)]/[0.05] px-3.5 pt-3"
        style={{
          maskImage: "linear-gradient(to bottom, #000 72%, transparent 100%)",
        }}
      >
        {author && (
          <div className="flex items-center gap-2">
            <img
              src={author.avatar}
              alt=""
              aria-hidden
              className="size-5 shrink-0 rounded-[5px] object-cover"
            />
            <span className="text-[12.5px] font-medium text-[var(--site-ink)]">
              {author.name}
            </span>
          </div>
        )}
        {post.blocks.map((block, i) => (
          <Block key={i} block={block} />
        ))}
      </div>
    </div>
  );
}

/**
 * Renders a card at full size inside a wrapper that reserves the scaled-down
 * footprint, so the miniatures still take part in the page's layout.
 */
export function ScaledCard({
  width,
  height,
  scale,
  className,
  style,
  children,
}: {
  width: number;
  height: number;
  scale: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div
      className={cn("shrink-0", className)}
      style={{ width: width * scale, height: height * scale, ...style }}
    >
      <div
        style={{
          width,
          height,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {children}
      </div>
    </div>
  );
}
