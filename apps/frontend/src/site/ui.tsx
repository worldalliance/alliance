import { thumbnailSrc } from "@alliance/common/image-src";
import { cn } from "@alliance/shared/styles/util";
import {
  useState,
  type ComponentProps,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { Picture } from "vite-imagetools";
import texture from "../assets/redesign/drought-image.png?w=800;1600;2400&format=avif;webp;jpg&as=picture";

export const SITE_COL =
  "mx-auto w-full max-w-[1750px] px-5 sm:px-8 lg:px-[68px]";

/**
 * `display: contents` on the wrapper so the img stays a direct visual child of
 * the card it is absolutely positioned against.
 */
export function SitePicture({
  image,
  alt,
  sizes,
  className,
  style,
  loading = "lazy",
  fetchPriority,
}: {
  image: Picture;
  alt: string;
  sizes: string;
  className?: string;
  style?: CSSProperties;
  loading?: "eager" | "lazy";
  fetchPriority?: "high" | "low" | "auto";
}) {
  return (
    <picture className="contents">
      {Object.entries(image.sources).map(([format, srcset]) => (
        <source
          key={format}
          type={`image/${format}`}
          srcSet={srcset}
          sizes={sizes}
        />
      ))}
      <img
        src={image.img.src}
        width={image.img.w}
        height={image.img.h}
        alt={alt}
        sizes={sizes}
        loading={loading}
        fetchPriority={fetchPriority}
        decoding="async"
        className={className}
        style={style}
      />
    </picture>
  );
}

/**
 * The h1 size, shared by the hero and every page header behind the nav. Steps
 * DisplayHeading down from its own sm and lg sizes, keeping its 2.5rem base.
 */

/** Both form submits: one box, and the fill is all that separates them. */
export const SITE_SUBMIT =
  "inline-flex min-h-12 w-fit items-center gap-2 px-5 text-base font-medium transition-colors disabled:opacity-60";

/**
 * A member photo at thumbnail size, falling back to the full-size upload when
 * no thumbnail exists. Needs `key={src}` so the fallback resets per photo.
 */
export function ThumbnailImg({
  src,
  ...props
}: Omit<ComponentProps<"img">, "src"> & { src: string }) {
  const [missing, setMissing] = useState(false);
  return (
    <img
      {...props}
      src={missing ? src : thumbnailSrc(src)}
      onError={() => setMissing(true)}
    />
  );
}

export function TexturedFill() {
  return (
    <SitePicture
      image={texture}
      alt=""
      sizes="100vw"
      className="absolute inset-0 size-full object-cover"
      style={{
        mixBlendMode: "screen",
        filter: "grayscale(1) contrast(1.05)",
        opacity: 0.2,
      }}
    />
  );
}

/**
 * A solid tinted card with a desaturated photo screened over it, which is the
 * treatment the milestone panel established.
 */
export function TexturedPanel({
  tint,
  children,
  className,
}: {
  tint: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden px-5 py-7 sm:px-10 sm:py-10 lg:px-[78px]",
        className,
      )}
      style={{
        borderRadius: "var(--site-radius-card)",
        backgroundColor: tint,
      }}
    >
      <TexturedFill />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export enum QuoteMarkKind {
  /** Slab low, tail up-left. `design/quotation down.png`. Opens a quote. */
  Open = "open",
  /** Slab high, tail down-left. `design/quotation up.png`. Closes a quote. */
  Close = "close",
}

/**
 * The slab-and-tail quote glyph from the Figma assets, as a path so it can be
 * tinted. The two assets are a vertical mirror pair, not a rotation.
 */
export function QuoteMark({
  kind,
  flipped = false,
  className,
}: {
  kind: QuoteMarkKind;
  /** Mirrors the glyph left to right, so a pair faces inward. */
  flipped?: boolean;
  className?: string;
}) {
  const mark = "M0 0H40V38L18 79H0L22 38H0Z";
  const scaleY = kind === QuoteMarkKind.Open ? -1 : 1;
  const scaleX = flipped ? -1 : 1;
  return (
    <svg
      viewBox="0 0 90 79"
      className={cn("shrink-0", className)}
      style={{ transform: `scale(${scaleX}, ${scaleY})` }}
      aria-hidden
    >
      <path d={mark} fill="currentColor" />
      <path d={mark} fill="currentColor" transform="translate(50 0)" />
    </svg>
  );
}

export function Logotype({
  onDark = false,
  className,
}: {
  onDark?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "font-logotype leading-none whitespace-nowrap",
        onDark ? "text-white" : "text-black",
        className,
      )}
    >
      The Alliance
    </span>
  );
}

export const SITE_INPUT =
  "w-full border border-[var(--site-ink)]/15 bg-white px-3.5 py-2.5 text-base text-[var(--site-ink)] outline-none transition-colors placeholder:text-[var(--site-ink)]/35 focus:border-[var(--site-primary)]";

export const SITE_INPUT_STYLE = { borderRadius: "var(--site-radius-input)" };

/** Label above the control, with the asterisk the required ones carry. */
export function SiteField({
  label,
  name,
  required = false,
  onDark = false,
  children,
  className,
}: {
  label: string;
  name: string;
  required?: boolean;
  /** Set where the field sits on a primary band rather than the surface. */
  onDark?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label htmlFor={name} className={cn("flex flex-col gap-1.5", className)}>
      <span
        className={cn(
          "text-sm font-medium",
          onDark ? "text-white/75" : "text-[var(--site-ink)]/70",
        )}
      >
        {label}
        {required && (
          <span
            className={onDark ? "text-white/50" : "text-[var(--site-primary)]"}
            aria-hidden
          >
            {" *"}
          </span>
        )}
      </span>
      {children}
    </label>
  );
}

/** The oversized display heading, which every page uses as its h1. */
export function DisplayHeading({
  children,
  className,
  as: Tag = "h2",
  onDark = false,
  leading = 1.35,
}: {
  children: ReactNode;
  className?: string;
  as?: "h1" | "h2";
  onDark?: boolean;
  /**
   * Unitless line height. Below the 1.35 default, descenders for this face
   * start catching the line underneath, so anything tighter wants checking at
   * the narrow widths where the heading wraps most.
   */
  leading?: number;
}) {
  return (
    <Tag
      className={cn(
        "site-display font-medium text-balance",
        onDark ? "text-white" : "text-black",
        className,
      )}
      /**
       * `leading-*` is a Tailwind "font-size" utility as far as tailwind-merge is
       * concerned, so any caller-supplied text-size className silently strips it.
       */
      style={{ lineHeight: leading }}
    >
      {children}
    </Tag>
  );
}

/** Companion to the hero's DisplayHeading. Landing page only. */
/** Section sits under a BandHeading, Page under a page's h1, Display under a hero. */
export enum SubtitleSize {
  Section = "section",
  Page = "page",
  Display = "display",
}

const subtitleClasses: Record<
  SubtitleSize,
  { base: string; onLight: string; onDark: string }
> = {
  [SubtitleSize.Section]: {
    base: "max-w-[50.4rem] text-xl leading-snug sm:text-2xl",
    onLight: "text-(--site-ink)/90",
    onDark: "text-white/75",
  },
  [SubtitleSize.Page]: {
    base: "max-w-2xl text-lg sm:text-xl md:text-2xl",
    onLight: "text-(--site-ink)/90",
    onDark: "text-white/90",
  },
  [SubtitleSize.Display]: {
    base: "max-w-xl text-lg leading-snug sm:text-2xl",
    onLight: "text-(--site-ink)",
    onDark: "text-white",
  },
};

export function SiteSubtitle({
  children,
  className,
  onDark = false,
  size = SubtitleSize.Section,
}: {
  children: ReactNode;
  className?: string;
  onDark?: boolean;
  size?: SubtitleSize;
}) {
  const tone = subtitleClasses[size];
  return (
    <p
      className={cn(tone.base, onDark ? tone.onDark : tone.onLight, className)}
    >
      {children}
    </p>
  );
}
