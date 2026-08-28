import { cn } from "@alliance/shared/styles/util";
import { Check } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import {
  ActivityKind,
  PostBlockKind,
  type HeroActivity,
  type PostBlock,
} from "../content";

/**
 * The cards are miniatures of a real product screen, laid out at full size and
 * scaled down as a unit. Everything sized here is in the card's own pixels.
 */
export const POST_CARD_WIDTH = 440;

function Paragraph({
  lead,
  text,
  link,
}: Extract<PostBlock, { kind: PostBlockKind.Paragraph }>) {
  return (
    <div className="text-[13px] leading-[1.45] text-[var(--rd-ink)]/80">
      <p>
        {lead && (
          <span className="font-semibold text-[var(--rd-ink)]">{lead} </span>
        )}
        {text}
      </p>
      {link && (
        <span className="mt-1 block break-all text-[12.5px] leading-[1.4] text-[var(--rd-primary)] underline">
          {link}
        </span>
      )}
    </div>
  );
}

function Photos({
  photos,
  feature,
}: Extract<PostBlock, { kind: PostBlockKind.Photos }>) {
  if (feature) {
    return (
      // Runs to the card's edges and takes whatever height is left.
      <img
        src={photos[0]}
        alt=""
        aria-hidden
        className="-mx-4 -mb-3.5 min-h-0 w-[calc(100%+2rem)] flex-1 object-cover"
        style={{ objectPosition: "center 42%" }}
      />
    );
  }

  const single = photos.length === 1;
  return (
    <div className={cn("grid gap-1", single ? "grid-cols-1" : "grid-cols-4")}>
      {photos.map((photo, i) => (
        <img
          key={`${photo}-${i}`}
          src={photo}
          alt=""
          aria-hidden
          className={cn(
            "w-full object-cover",
            single ? "h-[150px] rounded-[3px]" : "aspect-square rounded-[2px]",
          )}
          loading="lazy"
        />
      ))}
    </div>
  );
}

function Block({ block }: { block: PostBlock }) {
  switch (block.kind) {
    case PostBlockKind.Paragraph:
      return <Paragraph {...block} />;
    case PostBlockKind.Heading:
      return (
        <h3 className="text-[13px] font-semibold text-[var(--rd-ink)]">
          {block.text}
        </h3>
      );
    case PostBlockKind.List:
      return (
        <ul className="flex flex-col gap-1.5 pl-4 text-[12.5px] leading-[1.45] text-[var(--rd-ink)]/80">
          {block.items.map((item) => (
            <li
              key={item.lead}
              className="list-disc marker:text-[var(--rd-ink)]/40"
            >
              <span className="font-semibold text-[var(--rd-ink)]">
                {item.lead}
              </span>{" "}
              {item.text}
            </li>
          ))}
        </ul>
      );
    case PostBlockKind.Photos:
      return <Photos {...block} />;
    default:
      throw new Error(`unknown post block: ${block satisfies never}`);
  }
}

function ActionLink({ label }: { label: string }) {
  return (
    <span className="text-[12.5px] leading-tight text-[var(--rd-accent)] underline">
      {label}
    </span>
  );
}

function Avatar({ src, size }: { src: string; size: string }) {
  return (
    <img
      src={src}
      alt=""
      aria-hidden
      className={cn("shrink-0 rounded-[5px] object-cover", size)}
    />
  );
}

/** The outcome we publish once an action closes. */
function UpdateHeader({
  item,
}: {
  item: Extract<HeroActivity, { kind: ActivityKind.Update }>;
}) {
  return (
    <>
      <p className="flex items-baseline gap-2">
        <span className="text-[14px] leading-tight font-semibold text-[var(--rd-ink)]">
          {item.title}
        </span>
        <span className="shrink-0 text-[11.5px] text-[var(--rd-ink)]/45">
          {item.timeAgo}
        </span>
      </p>
      <ActionLink label={item.actionLabel} />
    </>
  );
}

/** One member's submission, headed by who finished which action. */
function CompletionHeader({
  item,
}: {
  item: Extract<HeroActivity, { kind: ActivityKind.Completion }>;
}) {
  return (
    <>
      <p className="flex items-center gap-1.5 text-[12.5px] text-[var(--rd-ink)]/70">
        <Avatar src={item.avatar} size="size-[18px]" />
        <span className="font-semibold text-[var(--rd-ink)]">
          {item.author}
        </span>
        completed
        <Check
          className="size-3 shrink-0 text-[var(--rd-primary)]"
          strokeWidth={3}
          aria-hidden
        />
      </p>
      <ActionLink label={item.actionLabel} />
    </>
  );
}

function CommentHeader({
  item,
}: {
  item: Extract<HeroActivity, { kind: ActivityKind.Comment }>;
}) {
  return (
    <div className="flex items-center gap-2">
      <Avatar src={item.avatar} size="size-7" />
      <p className="flex items-baseline gap-1.5">
        <span className="text-[13px] font-semibold text-[var(--rd-ink)]">
          {item.author}
        </span>
        <span className="text-[11.5px] text-[var(--rd-ink)]/45">
          {item.timeAgo}
        </span>
      </p>
    </div>
  );
}

function Header({ item }: { item: HeroActivity }) {
  switch (item.kind) {
    case ActivityKind.Update:
      return <UpdateHeader item={item} />;
    case ActivityKind.Completion:
      return <CompletionHeader item={item} />;
    case ActivityKind.Comment:
      return <CommentHeader item={item} />;
    default:
      throw new Error(`unknown activity: ${item satisfies never}`);
  }
}

/**
 * A feed card, built like the third "how does it work" box: the outcome and its
 * action link on white, then the write-up on an inset tinted panel headed by
 * whoever wrote it. Cards carrying a photo skip the panel, since the photo is
 * the body. Longer bodies run past the frame and fade at its foot; a card
 * ending in a feature photo does not, since the photo fills the space exactly.
 */
export function PostCard({
  item,
  className,
}: {
  item: HeroActivity;
  className?: string;
}) {
  const last = item.blocks[item.blocks.length - 1];
  const endsOnPhoto = last.kind === PostBlockKind.Photos && last.feature;
  const hasPhoto = item.blocks.some(
    (block) => block.kind === PostBlockKind.Photos,
  );

  const fade = endsOnPhoto
    ? undefined
    : { maskImage: "linear-gradient(to bottom, #000 72%, transparent 100%)" };

  const blocks = item.blocks.map((block, i) => (
    <Block key={`${item.id}-${i}`} block={block} />
  ));

  return (
    <div
      className={cn(
        "flex h-full flex-col overflow-hidden bg-white",
        "border border-[var(--rd-ink)]/12 shadow-[0_10px_30px_-18px_rgba(0,0,0,0.4)]",
        className,
      )}
      style={{ borderRadius: "var(--rd-radius-card)" }}
    >
      <header className="flex flex-col gap-1 px-4 pt-3.5 pb-3">
        <Header item={item} />
      </header>
      {hasPhoto ? (
        <div
          className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-3.5"
          style={fade}
        >
          {blocks}
        </div>
      ) : (
        <div
          className="mx-4 flex min-h-0 flex-1 flex-col gap-2.5 bg-[var(--rd-ink)]/[0.05] px-3.5 pt-3"
          style={fade}
        >
          {/* Updates carry no person in their header, so the panel names one. */}
          {item.kind === ActivityKind.Update && (
            <div className="flex items-center gap-2">
              <Avatar src={item.avatar} size="size-5" />
              <span className="text-[12.5px] font-medium text-[var(--rd-ink)]">
                {item.author}
              </span>
            </div>
          )}
          {blocks}
        </div>
      )}
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
