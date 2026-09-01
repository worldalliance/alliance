import { cn } from "@alliance/shared/styles/util";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  PEOPLE_CTA,
  testimonials,
  type Testimonial as TestimonialData,
} from "../content";
import { rdHref, RedesignPage } from "../links";
import { TestimonialKind, type RedesignTheme } from "../theme";
import { QuoteMarkKind, RD_COL, RdButton, RdQuoteMark } from "../ui";

const primary = testimonials[0];

function Attribution({
  person,
  onDark = false,
  className,
}: {
  person: TestimonialData;
  onDark?: boolean;
  className?: string;
}) {
  return (
    <figcaption className={cn("flex items-center gap-2.5", className)}>
      <img
        src={person.avatar}
        alt=""
        aria-hidden
        className="size-9 rounded-[5px] object-cover"
      />
      <span className="text-left leading-tight">
        <span
          className={cn(
            "block text-[0.85rem] font-semibold",
            onDark ? "text-white" : "text-[var(--rd-ink)]",
          )}
        >
          {person.name}
        </span>
        <span
          className={cn(
            "block text-[0.8rem]",
            onDark ? "text-white/70" : "text-[var(--rd-ink)]/55",
          )}
        >
          {person.role}
        </span>
      </span>
    </figcaption>
  );
}

function Quote({
  person,
  onDark = false,
  className,
}: {
  person: TestimonialData;
  onDark?: boolean;
  className?: string;
}) {
  return (
    <blockquote
      className={cn(
        "text-[1.1rem] leading-[1.55] font-normal sm:text-[1.33rem]",
        onDark ? "text-white" : "text-[var(--rd-ink)]",
        className,
      )}
    >
      {person.quoteLead}
      <strong className="font-semibold">{person.quoteEmphasis}</strong>
    </blockquote>
  );
}

/**
 * Landing 1: marks bracket the column, opening low-left, closing high-right.
 * `closingBesideText` pulls the closing mark up to the last line of the quote
 * instead of letting it hang below the attribution.
 */
function BracketedLayout({
  closingBesideText,
  padding,
}: {
  closingBesideText: boolean;
  padding: string;
}) {
  const closingMark = (
    <RdQuoteMark
      kind={QuoteMarkKind.Close}
      className={cn(
        "absolute -right-[118px] hidden w-[90px] text-[var(--rd-ink)]/[0.11] lg:block",
        closingBesideText ? "-bottom-10" : "-bottom-14",
      )}
    />
  );

  return (
    <section className={cn("bg-[var(--rd-surface)]", padding)}>
      <div className={RD_COL}>
        <figure className="relative mx-auto flex max-w-[600px] flex-col gap-5">
          <RdQuoteMark
            kind={QuoteMarkKind.Open}
            flipped
            className="absolute -top-8 -left-[118px] hidden w-[90px] text-[var(--rd-ink)]/[0.11] lg:block"
          />
          {closingBesideText ? (
            <div className="relative">
              <Quote person={primary} />
              {closingMark}
            </div>
          ) : (
            <>
              <Quote person={primary} />
              {closingMark}
            </>
          )}
          <Attribution person={primary} />
        </figure>
      </div>
    </section>
  );
}

function BracketedTestimonial() {
  return (
    <BracketedLayout
      closingBesideText={false}
      padding="pt-20 pb-32 lg:pt-24 lg:pb-44"
    />
  );
}

/** Matched to the breathing room around "how does it work". */
function BracketedInlineTestimonial() {
  return (
    <BracketedLayout closingBesideText padding="pt-6 pb-20 lg:pt-5 lg:pb-28" />
  );
}

/**
 * Version 2: the other two quotes sit angled behind the active card, so the
 * arrows have something to point at.
 */
function DeckTestimonial({ theme }: { theme: RedesignTheme }) {
  const [index, setIndex] = useState(0);
  const person = testimonials[index];
  const step = (delta: number) =>
    setIndex((i) => (i + delta + testimonials.length) % testimonials.length);

  return (
    <section className="bg-[var(--rd-surface)] pt-10 pb-24 lg:pt-12 lg:pb-32">
      <div className={cn(RD_COL, "flex flex-col items-center gap-14")}>
        <div className="relative isolate mx-auto w-full max-w-3xl">
          {[2, 1].map((depth) => (
            <div
              key={depth}
              className="absolute inset-x-3 top-0 h-full border border-[var(--rd-ink)]/15 bg-white shadow-[0_8px_24px_-18px_rgba(0,0,0,0.4)] transition-transform duration-[620ms] ease-[cubic-bezier(0.34,1.4,0.64,1)]"
              style={{
                borderRadius: "var(--rd-radius-card)",
                transform: `rotate(${(depth + index) % 2 === 0 ? -3.4 : 2.8}deg) translateY(${depth * 9}px)`,
                zIndex: 0,
              }}
              aria-hidden
            />
          ))}
          <figure
            key={person.id}
            className="rd-deck-card relative z-10 flex flex-col gap-5 border border-[var(--rd-ink)]/12 bg-white p-8 sm:p-11"
            style={{ borderRadius: "var(--rd-radius-card)" }}
          >
            <RdQuoteMark
              kind={QuoteMarkKind.Open}
              className="w-[54px] text-[var(--rd-primary)]/20"
            />
            <Quote person={person} className="min-h-[13rem]" />
            <div className="flex flex-wrap items-center justify-between gap-4">
              <Attribution person={person} />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => step(-1)}
                  aria-label="Previous testimonial"
                  className="flex size-11 items-center justify-center border border-[var(--rd-ink)]/20 text-[var(--rd-primary)] transition-colors hover:bg-[var(--rd-ink)]/5"
                  style={{ borderRadius: "var(--rd-radius-button)" }}
                >
                  <ChevronLeft className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => step(1)}
                  aria-label="Next testimonial"
                  className="flex size-11 items-center justify-center border border-[var(--rd-ink)]/20 text-[var(--rd-primary)] transition-colors hover:bg-[var(--rd-ink)]/5"
                  style={{ borderRadius: "var(--rd-radius-button)" }}
                >
                  <ChevronRight className="size-4" aria-hidden />
                </button>
              </div>
            </div>
          </figure>
        </div>
        <RdButton
          href={rdHref(theme.version, RedesignPage.People)}
          tone="outline"
          size="sm"
          withArrow
        >
          {PEOPLE_CTA}
        </RdButton>
      </div>
    </section>
  );
}

/**
 * Version 3: attribution and the pill call to action hold the left column, the
 * quote runs large down the right. Marks sit inline with the text.
 */
function SplitTestimonial({ theme }: { theme: RedesignTheme }) {
  return (
    <section className="bg-[var(--rd-surface-alt)] pt-16 pb-24 lg:pt-20 lg:pb-32">
      <div className={RD_COL}>
        <figure className="grid gap-8 lg:grid-cols-[15rem_1fr] lg:gap-16">
          <div className="flex flex-col items-start gap-6">
            <Attribution person={primary} />
            <RdButton
              href={rdHref(theme.version, RedesignPage.People)}
              tone="outline"
              size="sm"
              withArrow
            >
              {PEOPLE_CTA}
            </RdButton>
          </div>
          <div className="flex flex-col items-end gap-4">
            <Quote
              person={primary}
              className="rd-headline text-[1.55rem] leading-[1.32] font-normal text-[var(--rd-primary)] sm:text-[2rem]"
            />
            <RdQuoteMark
              kind={QuoteMarkKind.Close}
              className="w-[72px] text-[var(--rd-primary)]/25"
            />
          </div>
        </figure>
      </div>
    </section>
  );
}

const testimonialByKind: Record<
  TestimonialKind,
  (props: { theme: RedesignTheme }) => ReactNode
> = {
  [TestimonialKind.Bracketed]: BracketedTestimonial,
  [TestimonialKind.BracketedInline]: BracketedInlineTestimonial,
  [TestimonialKind.Deck]: DeckTestimonial,
  [TestimonialKind.Split]: SplitTestimonial,
};

export function Testimonial({ theme }: { theme: RedesignTheme }) {
  const Component = testimonialByKind[theme.testimonial];
  return <Component theme={theme} />;
}
