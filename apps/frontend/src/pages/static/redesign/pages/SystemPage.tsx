import { cn } from "@alliance/shared/styles/util";
import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { FEATURED_IMPACT_ACTIONS } from "../../../../content/featuredImpactActions";
import { activityById, activityRows, priorities } from "../content";
import { PostCard, ScaledCard } from "../graphics/PostCard";
import {
  CommitSignatureCard,
  TaskProgressCard,
  UpdateSlideCard,
} from "../graphics/ProductCards";
import {
  DETAIL_HEIGHT,
  DETAIL_WIDTH,
  FEED_HEIGHT,
  FEED_WIDTH,
  FeedCard,
  PostDetailCard,
} from "../graphics/ProductScreens";
import { JOIN_SUBMITTED_BODY, JOIN_SUBMITTED_TITLE } from "../pageContent";
import { ImpactCard } from "../sections/PageCards";
import { BandHeading, BandLede } from "../sections/PageShell";
import {
  LINK_BLUE,
  PANEL_GREEN,
  PRIORITY_TINTS,
  redesignThemes,
  RedesignVersion,
  themeVars,
} from "../theme";
import {
  DisplayHeading,
  QuoteMarkKind,
  RD_COL,
  RD_INPUT,
  RdArrow,
  RdField,
  RdQuoteMark,
  RdTexturedPanel,
  SectionHeading,
} from "../ui";

/**
 * An inventory of every style mockup 6 puts on screen, so drift is visible in
 * one place. Every specimen below is the real component or the literal class
 * string copied from its source, and each carries where it came from and what
 * uses it.
 *
 * Scoped to mockup 6 alone: a style another version renders and this one does
 * not is absent, and a class the theme merges away is not counted. Reached from
 * the console at the foot of any mockup. Not a mockup itself.
 */

const theme = redesignThemes[RedesignVersion.V6];

const MONO = "font-mono text-[11px] leading-relaxed";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1 pt-16">
      <h2 className={cn(MONO, "tracking-widest text-[#1E68D9] uppercase")}>
        {title}
      </h2>
      <div className="flex flex-col">{children}</div>
    </section>
  );
}

/**
 * One specimen. `source` names the file and export it lives in; `used` names
 * the places mockup 6 renders it; `spec` is the literal declaration.
 */
function Spec({
  name,
  source,
  used,
  spec,
  dark = false,
  children,
}: {
  name: string;
  source: string;
  used?: string;
  spec?: string;
  /** Renders the specimen on the primary band, where it belongs there. */
  dark?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-4 border-t border-black/10 py-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-10">
      <div
        className={cn(
          "min-w-0",
          dark && "-mx-4 rounded-md bg-[var(--rd-primary)] px-4 py-4",
        )}
      >
        {children}
      </div>
      <dl className={cn(MONO, "flex flex-col gap-1 text-black/55")}>
        <div>
          <dt className="inline font-semibold text-black/80">{name}</dt>
        </div>
        <div>
          <dt className="inline text-black/35">from </dt>
          <dd className="inline">{source}</dd>
        </div>
        {used && (
          <div>
            <dt className="inline text-black/35">used </dt>
            <dd className="inline">{used}</dd>
          </div>
        )}
        {spec && (
          <div>
            <dt className="inline text-black/35">spec </dt>
            <dd className="inline break-words">{spec}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

function Swatch({
  value,
  name,
  source,
  used,
}: {
  value: string;
  name: string;
  source: string;
  used: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span
        className="h-16 w-full rounded-md border border-black/10"
        style={{ backgroundColor: value }}
      />
      <div className={cn(MONO, "text-black/55")}>
        <p className="font-semibold text-black/80">{name}</p>
        <p>{value}</p>
        <p className="text-black/35">{source}</p>
        <p>{used}</p>
      </div>
    </div>
  );
}

/** Every distinct `text-[…]` mockup 6 renders, counted. */
const TEXT_SIZE_CENSUS: { size: string; count: number }[] = [
  { size: "text-sm", count: 12 },
  { size: "1.05rem", count: 7 },
  { size: "1.08rem", count: 7 },
  { size: "1.2rem", count: 6 },
  { size: "0.95rem", count: 6 },
  { size: "0.82rem", count: 5 },
  { size: "1.9rem", count: 5 },
  { size: "2.4rem", count: 5 },
  { size: "1rem", count: 5 },
  { size: "text-base", count: 4 },
  { size: "1.75rem", count: 4 },
  { size: "0.85rem", count: 4 },
  { size: "13px", count: 4 },
  { size: "12.5px", count: 4 },
  { size: "text-2xl", count: 3 },
  { size: "3.6rem", count: 3 },
  { size: "1.35rem", count: 3 },
  { size: "1.45rem", count: 3 },
  { size: "1.12rem", count: 3 },
  { size: "1.02rem", count: 3 },
];

const TWICE_USED_SIZES =
  "2 1.15 0.98 0.88 0.8 0.78 rem, and text-lg";

const ONE_OFF_SIZES =
  "3.2 3.1 3 2.9 2.7 2.6 2.5 2.2 2.1 1.95 1.7 1.5 1.4 1.33 1.3 1.1 0.92 0.9 0.72 0.7 rem, 14 11.5 px, text-xl, text-xs";

const SHADOWS = [
  { value: "0 1px 0 rgba(0,0,0,0.07)", used: "Nav, once scrolled" },
  { value: "0 10px 30px -18px rgba(0,0,0,0.4)", used: "PostCard" },
  {
    value: "0 18px 45px -20px rgba(4,14,32,0.55)",
    used: "the hero's feed and opened post",
  },
];

function Colours() {
  return (
    <Section title="Colour">
      <div className="grid gap-6 border-t border-black/10 py-6 sm:grid-cols-3 lg:grid-cols-4">
        <Swatch
          value={theme.primary}
          name="--rd-primary"
          source="theme.ts"
          used="h2, nav log in, footer, photo overlays, page headers"
        />
        <Swatch
          value={theme.primaryHover}
          name="--rd-primary-hover"
          source="theme.ts"
          used="nav log in and the two form submits, on hover"
        />
        <Swatch
          value={theme.accent}
          name="--rd-accent"
          source="theme.ts"
          used="progress bars and checks · the same value as primary here"
        />
        <Swatch
          value={theme.surface}
          name="--rd-surface"
          source="theme.ts"
          used="page background, card title bars"
        />
        <Swatch
          value={theme.surfaceAlt}
          name="--rd-surface-alt"
          source="theme.ts"
          used="priority band, how-it-works band, activity card header"
        />
        <Swatch
          value={theme.ink}
          name="--rd-ink"
          source="theme.ts"
          used="body copy, and every /NN opacity derived from it"
        />
        <Swatch
          value={LINK_BLUE}
          name="LINK_BLUE"
          source="theme.ts"
          used="written literally six times: the CTA hover stroke, the impact card's member count, the activity action, the partner pledge border, the partner task link, the channel checkboxes"
        />
        <Swatch
          value={PANEL_GREEN}
          name="PANEL_GREEN"
          source="theme.ts"
          used="the partner and progress panels, which have to sit apart from the primary bands around them"
        />
        <Swatch
          value={PRIORITY_TINTS[0]}
          name="PRIORITY_TINTS[0]"
          source="theme.ts"
          used="priority cards 1 and 3, home page and guide"
        />
        <Swatch
          value={PRIORITY_TINTS[1]}
          name="PRIORITY_TINTS[1]"
          source="theme.ts"
          used="priority cards 2 and 4, home page and guide"
        />
      </div>
      <p className={cn(MONO, "pt-2 text-black/55")}>
        Everything else is an opacity of ink or white: 21 distinct steps of{" "}
        <span className="text-black/80">--rd-ink</span>, from /[0.05] to /85, and
        14 of <span className="text-black/80">white</span>, from /10 to /90.
      </p>
    </Section>
  );
}

const FACES = [
  {
    name: "TT Neoris",
    css: "--rd-font-body",
    style: { fontFamily: '"TT Neoris", system-ui, sans-serif' },
    used: "body face, everything not set below",
    note: "trial licence",
  },
  {
    name: "Libre Caslon Text",
    css: "--rd-font-display",
    style: { fontFamily: '"Libre Caslon Text", Georgia, serif' },
    used: "logotype, the h1, band and guide headings, the priorities note",
  },
  {
    name: "Alex Brush",
    css: ".rd-signature",
    style: { fontFamily: '"Alex Brush", cursive' },
    used: "the signature in the commitment card, and nowhere else",
  },
];

function Faces() {
  return (
    <Section title="Type faces">
      {FACES.map((face) => (
        <Spec
          key={face.name}
          name={face.name}
          source={`redesign.css · ${face.css}`}
          used={face.used}
          spec={face.note}
        >
          <p className="text-[2.2rem] leading-tight" style={face.style}>
            We’re assembling a group that cooperates
          </p>
        </Spec>
      ))}
    </Section>
  );
}

function Headings() {
  return (
    <Section title="Headings">
      <Spec
        name="Hero h1"
        source="sections/Hero.tsx · Headline"
        used="the home page, beside the product pair"
        spec="text-[2.6rem] sm:text-[3rem] lg:text-[3.6rem] · Caslon 400 · the hero passes the two larger steps, so Headline's own sm:3.6 lg:4.4 never lands"
      >
        <h1
          className="rd-headline text-[2.6rem] leading-[1.07] text-[var(--rd-primary)] sm:text-[3rem] lg:text-[3.6rem]"
          style={{ fontWeight: theme.headlineWeight }}
        >
          We’re assembling a group that cooperates
        </h1>
      </Spec>

      <Spec
        name="Subpage h1"
        source="ui.tsx · DisplayHeading, via PageShell · PageHeader"
        used="every page behind the nav"
        spec="text-[2.5rem] sm:text-[2.7rem] lg:text-[3.2rem] max-w-[64rem] · the page's own name sits above it as the eyebrow"
        dark
      >
        <DisplayHeading
          theme={theme}
          as="h1"
          className="max-w-[64rem] text-white sm:text-[2.7rem] lg:text-[3.2rem]"
        >
          A full-time office plans the actions.
        </DisplayHeading>
      </Spec>

      <Spec
        name="Subpage eyebrow"
        source="sections/PageShell.tsx · PageHeader"
        used="above every subpage h1"
        spec="text-[0.95rem] tracking-[0.14em] uppercase text-white/60"
        dark
      >
        <p className="text-[0.95rem] tracking-[0.14em] text-white/60 uppercase">
          People
        </p>
      </Spec>

      <Spec
        name="SectionHeading"
        source="ui.tsx · SectionHeading"
        used='"How does it work?" only'
        spec="text-[1.7rem] sm:text-[2rem] font-normal, body face"
      >
        <SectionHeading>How does it work?</SectionHeading>
      </Spec>

      <Spec
        name="BandHeading"
        source="sections/PageShell.tsx · BandHeading"
        used="every band on people, progress, partner"
        spec="text-[1.9rem] sm:text-[2.4rem], display face"
      >
        <BandHeading>Expert group</BandHeading>
      </Spec>

      <Spec
        name="Panel h2"
        source="sections/ModelSection.tsx, pages/PartnerPage.tsx, pages/ProgressPage.tsx"
        used="milestone panel, partner green panel, progress green panel"
        spec="milestone: text-[1.45rem] sm:text-[1.75rem] · the two panels: text-[1.9rem] sm:text-[2.4rem]"
        dark
      >
        <div className="flex flex-col gap-3">
          <h2 className="text-[1.45rem] leading-snug font-normal text-white sm:text-[1.75rem]">
            Since members commit to show up, we can plan projects
          </h2>
          <h2 className="rd-headline text-[1.9rem] leading-tight text-white sm:text-[2.4rem]">
            How we can help
          </h2>
        </div>
      </Spec>

      <Spec
        name="Guide section h2"
        source="pages/GuidePage.tsx"
        used="the six guide sections"
        spec="text-[1.9rem] sm:text-[2.2rem], display face"
      >
        <h2 className="rd-headline text-[1.9rem] leading-tight text-[var(--rd-primary)] sm:text-[2.2rem]">
          Introduction
        </h2>
      </Spec>

      <Spec
        name="Prose h2 / h3"
        source="sections/DocProse.tsx"
        used="guide, governance, foundation, FAQ, legal"
        spec="h2 text-[1.5rem] sm:text-[1.75rem] font-normal · h3 text-[1.2rem] font-medium"
      >
        <div className="flex flex-col gap-2">
          <h2 className="text-[1.5rem] leading-tight font-normal text-[var(--rd-primary)] sm:text-[1.75rem]">
            Prose h2
          </h2>
          <h3 className="text-[1.2rem] leading-tight font-medium">Prose h3</h3>
        </div>
      </Spec>

      <Spec
        name="FAQ question"
        source="pages/FaqPage.tsx"
        used="every row of the FAQ"
        spec="text-[1.15rem] sm:text-[1.3rem] primary, in a summary that carries a rotating plus"
      >
        <p className="text-[1.15rem] leading-snug text-[var(--rd-primary)] sm:text-[1.3rem]">
          What does the Alliance expect of a member?
        </p>
      </Spec>

      <Spec
        name="Priority card title"
        source="sections/Priorities.tsx"
        used="the four priority cards"
        spec="text-[1.75rem] sm:text-[2rem] font-normal, whitespace-pre-line so authored breaks hold"
        dark
      >
        <h3 className="text-[1.75rem] leading-[1.16] font-normal whitespace-pre-line text-white sm:text-[2rem]">
          {priorities[2].title}
        </h3>
      </Spec>

      <Spec
        name="Priority title, guide grid"
        source="pages/GuidePage.tsx · PriorityGrid"
        used="the guide's priorities section"
        spec="text-[1.4rem], authored breaks stripped"
        dark
      >
        <h3 className="text-[1.4rem] leading-tight text-white">
          {priorities[2].title.replace("\n", " ")}
        </h3>
      </Spec>
    </Section>
  );
}

function BodyText() {
  return (
    <Section title="Body and small text">
      <Spec
        name="Hero subhead"
        source="sections/Hero.tsx · ProductPairHero"
        used="under the h1, in the hero's left column"
        spec="text-lg sm:text-[1.35rem] max-w-[32rem], full-strength ink"
      >
        <p className="max-w-[32rem] text-lg leading-snug sm:text-[1.35rem]">
          To combat global problems, we commit 15 minutes each week to projects
          that depend on everyone’s participation.
        </p>
      </Spec>

      <Spec
        name="Priorities note"
        source="sections/Priorities.tsx"
        used="under the priority row, ranged left against the right margin"
        spec="rd-display text-[1.45rem] lg:text-[1.95rem] max-w-[32rem] ml-auto ink/85"
      >
        <p className="rd-display ml-auto max-w-[32rem] text-[1.45rem] leading-snug text-[var(--rd-ink)]/85 lg:text-[1.95rem]">
          We focus on urgent global crises that result from a lack of human
          coordination.
        </p>
      </Spec>

      <Spec
        name="BandLede"
        source="sections/PageShell.tsx · BandLede"
        used="under every BandHeading"
        spec="text-[1.08rem] sm:text-[1.2rem] max-w-[46rem] ink/70"
      >
        <BandLede>
          Experts occasionally lend time, knowledge, or resources to the
          Alliance.
        </BandLede>
      </Spec>

      <Spec
        name="Prose paragraph"
        source="sections/DocProse.tsx"
        used="every long-form page"
        spec="text-[1.05rem] sm:text-[1.12rem] leading-[1.65] ink/85"
      >
        <p className="max-w-[46rem] text-[1.05rem] leading-[1.65] text-[var(--rd-ink)]/85 sm:text-[1.12rem]">
          The Alliance aims to facilitate large-scale coordination over the
          Internet. We are focused on four global crises.
        </p>
      </Spec>

      <Spec
        name="Card body"
        source="graphics/ProductCards.tsx"
        used="the three product screens, on the home page, the join page, and the guide"
        spec="text-[0.82rem] — five occurrences, the most reused size below 1rem"
      >
        <p className="text-[0.82rem] text-[var(--rd-ink)]">
          Sign the pledge to review one transcript
        </p>
      </Spec>

      <Spec
        name="Feed and post body"
        source="graphics/ProductScreens.tsx, graphics/PostCard.tsx"
        used="the hero pair, which is sized in the cards' own pixels and scaled down as a unit"
        spec="title 14px · paragraph and activity line 13px · list 12.5px · meta 11.5px"
      >
        <div className="flex flex-col gap-1">
          <p className="text-[14px] font-semibold">Title, 14px</p>
          <p className="text-[13px] text-[var(--rd-ink)]/80">Paragraph, 13px</p>
          <p className="text-[12.5px] text-[var(--rd-ink)]/80">List, 12.5px</p>
          <p className="text-[11.5px] text-[var(--rd-ink)]/45">Meta, 11.5px</p>
        </div>
      </Spec>

      <Spec
        name="Caption"
        source="pages/PeoplePage.tsx, sections/PageCards.tsx"
        used="photo captions, list notes"
        spec="text-sm ink/50 to /55 · also 0.95rem ink/45 for the same job on people"
      >
        <div className="flex flex-col gap-1">
          <p className="text-sm text-[var(--rd-ink)]/55">
            The office in San Francisco
          </p>
          <p className="text-[0.95rem] text-[var(--rd-ink)]/45">
            This list only includes experts who have chosen to make their
            information public.
          </p>
        </div>
      </Spec>

      <Spec
        name="Uppercase label"
        source="graphics/ProductCards.tsx, pages/PartnerPage.tsx"
        used="'sign your name'; the partner's name on a task card"
        spec="0.72rem tracking-wide ink/45 · 0.8rem tracking-[0.12em] LINK_BLUE"
      >
        <div className="flex flex-col gap-1">
          <p className="text-[0.72rem] tracking-wide text-[var(--rd-ink)]/45 uppercase">
            Sign your name
          </p>
          <p
            className="text-[0.8rem] font-medium tracking-[0.12em] uppercase"
            style={{ color: LINK_BLUE }}
          >
            apgard
          </p>
        </div>
      </Spec>
    </Section>
  );
}

function Buttons() {
  return (
    <Section title="Buttons and triggers">
      <Spec
        name="Every button on the mockup"
        source="sections/Nav.tsx; graphics/ProductCards.tsx · MockButton; sections/JoinRequest.tsx; pages/PartnerPage.tsx"
        used="the bar, the product screens, and the two forms"
        spec="four separate declarations, no shared height, padding, or hover · RdButton, which the other versions use, renders nowhere here"
      >
        <div className="flex flex-wrap items-center gap-3">
          <span
            className="inline-flex min-h-11 items-center gap-2 bg-[var(--rd-primary)] px-4 text-sm font-medium text-white"
            style={{ borderRadius: "var(--rd-radius-button)" }}
          >
            Nav log in
            <RdArrow className="size-2.5" />
          </span>
          <span
            className="inline-flex min-h-11 items-center border border-[var(--rd-ink)]/25 px-4 text-sm font-medium"
            style={{ borderRadius: "var(--rd-radius-button)" }}
          >
            Nav partner
          </span>
          <span
            className="px-6 py-2.5 text-center text-sm font-medium text-white"
            style={{
              backgroundColor: "var(--rd-primary)",
              borderRadius: "var(--rd-radius-button)",
            }}
          >
            MockButton
          </span>
          <span
            className="inline-flex min-h-12 items-center bg-[var(--rd-primary)] px-5 text-base font-medium text-white"
            style={{ borderRadius: "var(--rd-radius-button)" }}
          >
            Join submit
          </span>
          <span className="rounded bg-[var(--rd-primary)] p-2">
            <span
              className="inline-flex min-h-12 items-center bg-white px-5 text-base font-medium text-[var(--rd-primary)]"
              style={{ borderRadius: "var(--rd-radius-button)" }}
            >
              Partner submit
            </span>
          </span>
        </div>
      </Spec>

      <Spec
        name="Arrow"
        source="ui.tsx · RdArrow"
        used="nav log in and mobile menu, footer links, the model panel's partner link, the guide's resource links, the CTA corner"
        spec="traced from design/arrow-vector.svg · sizes here: 2.5 (four times), 3, 6"
      >
        <div className="flex items-end gap-4 text-[var(--rd-primary)]">
          <RdArrow className="size-2.5" />
          <RdArrow className="size-3" />
          <RdArrow className="size-6" />
        </div>
      </Spec>

      <Spec
        name="Text link"
        source="sections/ModelSection.tsx, pages/GuidePage.tsx, pages/PartnerPage.tsx, sections/DocProse.tsx"
        used="'Become a partner', guide resources, partner names, prose links"
        spec="three treatments: bare hover:underline, always-underlined LINK_BLUE, and decoration-primary/35"
      >
        <div className="flex flex-col gap-1 text-[1.02rem]">
          <span className="text-[var(--rd-primary)] hover:underline">
            Become a partner
          </span>
          <span className="underline" style={{ color: LINK_BLUE }}>
            apgard
          </span>
          <span className="text-[var(--rd-primary)] underline decoration-[var(--rd-primary)]/35 underline-offset-2">
            a prose link
          </span>
        </div>
      </Spec>

      <Spec
        name="Panel trigger"
        source="sections/JoinCta.tsx · PhotoCta, short"
        used="the closing CTA, which is one control the width of the column"
        spec="min-h-[315px] sm:min-h-[420px] · photo scales 1.06 and the primary overlay lifts from 0.42 to 0.28 on hover, with a LINK_BLUE stroke inset 3"
      >
        <div
          className="relative flex min-h-[130px] flex-col justify-end overflow-hidden bg-[var(--rd-primary)] p-5 text-white"
          style={{ borderRadius: "var(--rd-radius-card)" }}
        >
          <div
            className="pointer-events-none absolute inset-3 border"
            style={{
              borderColor: LINK_BLUE,
              borderRadius: "var(--rd-radius-card)",
            }}
            aria-hidden
          />
          <p className="text-[1.6rem] leading-none">Request to join</p>
          <span className="absolute right-5 bottom-5">
            <RdArrow className="size-6 text-white" />
          </span>
        </div>
      </Spec>
    </Section>
  );
}

function FormControls() {
  return (
    <Section title="Form controls">
      <Spec
        name="RD_INPUT"
        source="ui.tsx · RD_INPUT"
        used="every text field on join and partner"
        spec="border ink/15, bg-white, px-3.5 py-2.5, focus:border-primary"
      >
        <div className="max-w-sm">
          <RdField label="Organization" name="sys-org" required>
            <input
              id="sys-org"
              className={RD_INPUT}
              style={{ borderRadius: "var(--rd-radius-input)" }}
              placeholder="Placeholder"
            />
          </RdField>
        </div>
      </Spec>

      <Spec
        name="RdField label"
        source="ui.tsx · RdField"
        used="every field · onDark on the partner form, which sits on the primary band"
        spec="text-sm font-medium ink/70, required asterisk in primary · onDark: white/75 and white/50"
      >
        <div className="grid max-w-lg gap-4 sm:grid-cols-2">
          <RdField label="On surface" name="sys-a" required>
            <span className="text-sm text-[var(--rd-ink)]/40">…</span>
          </RdField>
          <div className="rounded bg-[var(--rd-primary)] p-3">
            <RdField label="On the band" name="sys-b" required onDark>
              <span className="text-sm text-white/40">…</span>
            </RdField>
          </div>
        </div>
      </Spec>

      <Spec
        name="Checkbox chip"
        source="pages/PartnerPage.tsx"
        used="the outreach channels field"
        spec="border white/25 on the blue panel, accent-[#1E68D9]"
      >
        <div className="flex flex-wrap gap-2 rounded bg-[var(--rd-primary)] p-3">
          {["Website", "Newsletter", "Social media"].map((channel) => (
            <span
              key={channel}
              className="flex items-center gap-2 border border-white/25 px-3 py-2 text-sm text-white"
              style={{ borderRadius: "var(--rd-radius-input)" }}
            >
              <input
                type="checkbox"
                readOnly
                className="size-4 accent-[#1E68D9]"
              />
              {channel}
            </span>
          ))}
        </div>
      </Spec>

      <Spec
        name="Submitted state"
        source="sections/JoinRequest.tsx · RequestToJoinForm"
        used="what the join form becomes once it is sent"
        spec="size-9 primary circle, then 1.35rem primary and 1.02rem ink/75"
      >
        <div className="flex flex-col items-start gap-3">
          <span className="flex size-9 items-center justify-center rounded-full bg-[var(--rd-primary)] text-white">
            <Check className="size-5" aria-hidden />
          </span>
          <p className="text-[1.35rem] leading-tight text-[var(--rd-primary)]">
            {JOIN_SUBMITTED_TITLE}
          </p>
          <p className="text-[1.02rem] leading-snug text-[var(--rd-ink)]/75">
            {JOIN_SUBMITTED_BODY}
          </p>
        </div>
      </Spec>
    </Section>
  );
}

function Avatars() {
  const faces = activityRows[0].avatars;

  return (
    <Section title="Avatars">
      <Spec
        name="Four treatments, one job"
        source="graphics/ProductScreens.tsx, graphics/PostCard.tsx, graphics/ProductCards.tsx, sections/Testimonial.tsx, pages/PeoplePage.tsx"
        used="activity rows, the opened post, the outcome card, the testimonial, experts and office"
        spec="butted strip in one rounded-[4px] outline · rounded-[5px] size-5 in the post, size-9 in the testimonial · plain rounded size-5 on the outcome card · rounded-[9px] initials slot at size-10 and size-[62px]"
      >
        <div className="flex flex-wrap items-center gap-8">
          <span className="flex h-[19px] overflow-hidden rounded-[4px] border border-[var(--rd-ink)]/20">
            {faces.map((src, i) => (
              <img
                key={i}
                src={src}
                alt=""
                className="h-full w-[17px] object-cover"
              />
            ))}
          </span>
          <img
            src={faces[0]}
            alt=""
            className="size-9 rounded-[5px] object-cover"
          />
          <img src={faces[0]} alt="" className="size-5 rounded object-cover" />
          <span className="flex size-[62px] items-center justify-center rounded-[9px] bg-[var(--rd-ink)]/[0.08] text-[0.95rem] font-medium text-[var(--rd-ink)]/45">
            JP
          </span>
        </div>
      </Spec>
    </Section>
  );
}

function Cards() {
  const withPhoto = FEATURED_IMPACT_ACTIONS.find((a) => a.imageSrc)!;
  const textOnly = FEATURED_IMPACT_ACTIONS.find((a) => !a.imageSrc)!;

  return (
    <Section title="Cards">
      <Spec
        name="The hero pair"
        source="graphics/ProductScreens.tsx · FeedCard, PostDetailCard"
        used="the hero, offset on a stage that scales as a unit"
        spec={`feed ${FEED_WIDTH}×${FEED_HEIGHT}, post ${DETAIL_WIDTH}×${DETAIL_HEIGHT}, both in card pixels · title bar on surface-alt, 13px semibold`}
      >
        <div className="flex flex-wrap items-start gap-4">
          <ScaledCard width={FEED_WIDTH} height={FEED_HEIGHT} scale={0.72}>
            <FeedCard />
          </ScaledCard>
          <ScaledCard width={DETAIL_WIDTH} height={DETAIL_HEIGHT} scale={0.72}>
            <PostDetailCard />
          </ScaledCard>
        </div>
      </Spec>

      <Spec
        name="PostCard"
        source="graphics/PostCard.tsx"
        used="inside the opened post, carrying the update"
        spec="border ink/12, shadow 0 10px 30px -18px · the body sits on an inset ink/[0.05] panel headed by whoever wrote it, and fades out at 72%"
      >
        <ScaledCard width={440} height={300} scale={0.7}>
          <PostCard item={activityById("chatbot-transcripts")} />
        </ScaledCard>
      </Spec>

      <Spec
        name="Product mockup card"
        source="graphics/ProductCards.tsx · MockCard"
        used="how it works, the join page, the guide"
        spec="h-[236px] fixed, border ink/15, px-5 pt-4, title mb-2.5 text-[1.02rem] font-semibold"
      >
        <div className="grid gap-4 md:grid-cols-3">
          <CommitSignatureCard />
          <TaskProgressCard />
          <UpdateSlideCard />
        </div>
      </Spec>

      <Spec
        name="ImpactCard"
        source="sections/PageCards.tsx · ImpactCard"
        used="progress, and the guide's actions section"
        spec="aspect-[16/10] image, p-5, emphasis text-[1.05rem] primary, rest 0.98rem ink/65, member count 0.85rem LINK_BLUE"
      >
        <div className="grid max-w-2xl gap-3 sm:grid-cols-2">
          <ImpactCard
            action={withPhoto}
            members={142}
            className="border border-[var(--rd-ink)]/10"
          />
          <ImpactCard
            action={textOnly}
            members={231}
            className="border border-[var(--rd-ink)]/10"
          />
        </div>
      </Spec>

      <Spec
        name="Priority card"
        source="sections/Priorities.tsx"
        used="the home page row, four across, pulled up over the hero"
        spec="aspect-[321/355], tint + screened grayscale photo at 0.52, title rides 36% to 18% on hover"
      >
        <div className="grid max-w-2xl gap-3 sm:grid-cols-2">
          {priorities.slice(0, 2).map((priority, index) => (
            <article
              key={priority.id}
              className="group relative isolate aspect-[321/355] overflow-hidden"
              style={{
                borderRadius: "var(--rd-radius-card)",
                backgroundColor: PRIORITY_TINTS[index],
              }}
            >
              <img
                src={priority.image}
                alt=""
                aria-hidden
                className="absolute inset-0 size-full object-cover"
                style={{
                  mixBlendMode: "screen",
                  filter: "grayscale(1) contrast(1.05)",
                  opacity: 0.52,
                }}
              />
              <span className="absolute top-[22px] left-6 z-10 h-[1.5px] w-[60px] bg-white/90" />
              <h3 className="absolute inset-x-6 top-[36%] z-10 text-[1.75rem] leading-[1.16] whitespace-pre-line text-white sm:text-[2rem]">
                {priority.title}
              </h3>
            </article>
          ))}
        </div>
      </Spec>

      <Spec
        name="Textured panel"
        source="ui.tsx · RdTexturedPanel"
        used="the milestone panel in primary, the partner and progress panels in green"
        spec="px-6 py-8 sm:px-[78px] sm:py-10, photo screened at 0.62 · the subpage header runs the same treatment at 0.5, the guide's priority tiles at 0.45"
      >
        <RdTexturedPanel tint={PANEL_GREEN}>
          <p className="text-white">Panel content sits here.</p>
        </RdTexturedPanel>
      </Spec>

      <Spec
        name="Quote mark"
        source="ui.tsx · RdQuoteMark"
        used="the testimonial, one mark at each end of the column"
        spec="open kind flips on Y, flipped prop mirrors on X · w-[90px] at ink/[0.11], hidden below lg"
      >
        <div className="flex items-start gap-6 text-[var(--rd-ink)]/[0.11]">
          <RdQuoteMark kind={QuoteMarkKind.Open} flipped className="w-[90px]" />
          <RdQuoteMark kind={QuoteMarkKind.Close} className="w-[90px]" />
        </div>
      </Spec>

      <Spec
        name="Progress bar and check"
        source="graphics/ProductCards.tsx, pages/PartnerPage.tsx, pages/JoinPage.tsx"
        used="the task card, the partner task cards, the join page's expectations"
        spec="h-2 rounded-full, track ink/12, fill --rd-accent · check size-4 rounded-full accent, size-6 on the join page"
      >
        <div className="flex max-w-sm flex-col gap-3">
          <div className="h-2 overflow-hidden rounded-full bg-[var(--rd-ink)]/12">
            <div
              className="h-full w-[81%] rounded-full"
              style={{ backgroundColor: theme.accent }}
            />
          </div>
          <span className="flex items-center gap-2 text-[0.85rem]">
            <span
              className="flex size-4 items-center justify-center rounded-full text-white"
              style={{ backgroundColor: theme.accent }}
            >
              <Check className="size-2.5" strokeWidth={3.5} />
            </span>
            a completed step
          </span>
        </div>
      </Spec>
    </Section>
  );
}

function Geometry() {
  return (
    <Section title="Radius, shadow, layout">
      <Spec
        name="Radii"
        source="theme.ts · radiusButton, radiusCard, radiusInput"
        used="every rounded surface"
        spec={`button ${theme.radiusButton}, card ${theme.radiusCard}, input ${theme.radiusInput} — button and input are the same value`}
      >
        <div className="flex flex-wrap gap-4">
          {(
            [
              ["button", theme.radiusButton],
              ["card", theme.radiusCard],
              ["input", theme.radiusInput],
            ] as const
          ).map(([label, radius]) => (
            <span
              key={label}
              className={cn(
                MONO,
                "flex h-16 w-28 items-center justify-center bg-[var(--rd-primary)] text-white",
              )}
              style={{ borderRadius: radius }}
            >
              {label}
            </span>
          ))}
        </div>
      </Spec>

      <Spec
        name="One-off radii"
        source="various"
        used="anything that bypasses the tokens"
        spec="rounded-[4px] activity strip · [5px] post and testimonial avatars, milestone bars · [7px] member tiles · [9px] expert slot · rounded, rounded-md, rounded-full"
      >
        <div className="flex flex-wrap items-end gap-3">
          {["4px", "5px", "7px", "9px", "0.25rem", "9999px"].map((radius) => (
            <span
              key={radius}
              className={cn(
                MONO,
                "flex size-14 items-center justify-center bg-[var(--rd-ink)]/12 text-black/60",
              )}
              style={{ borderRadius: radius }}
            >
              {radius}
            </span>
          ))}
        </div>
      </Spec>

      <Spec
        name="Shadows"
        source="various"
        used="three values, all on the home page"
        spec="no shared token; each one is written inline where it is used"
      >
        <div className="flex flex-col gap-2">
          {SHADOWS.map((shadow) => (
            <div key={shadow.value} className="flex items-center gap-4">
              <span
                className="h-8 w-24 shrink-0 rounded bg-white"
                style={{ boxShadow: shadow.value }}
              />
              <span className={cn(MONO, "text-black/55")}>
                <span className="text-black/80">{shadow.used}</span>
                {` — ${shadow.value}`}
              </span>
            </div>
          ))}
        </div>
      </Spec>

      <Spec
        name="RD_COL"
        source="ui.tsx · RD_COL"
        used="every band on every page"
        spec="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-[68px]"
      >
        <div className="border border-dashed border-black/25 bg-black/[0.03] px-5 py-4 sm:px-8 lg:px-[68px]">
          <p className={cn(MONO, "text-black/55")}>content column</p>
        </div>
      </Spec>

      <Spec
        name="The overlap pair"
        source="sections/Priorities.tsx · OVERLAP, OVERLAP_CLEARANCE"
        used="the priority row over the hero, and the milestone panel over how-it-works"
        spec="pull -mt-[27.6%] sm:-13.5% lg:-6.7% against the column · clearance pb-[calc(29%+2rem)] sm:[calc(14.4%+2.5rem)] lg:[calc(7%+3.5rem)] against the section · the model panel repeats the idea at -7/-6/-5%"
      >
        <div className="border border-dashed border-black/25 bg-black/[0.03] pb-[calc(29%+2rem)] sm:pb-[calc(14.4%+2.5rem)] lg:pb-[calc(7%+3.5rem)]">
          <p className={cn(MONO, "p-4 text-black/55")}>
            section, with the clearance the row above it needs
          </p>
        </div>
      </Spec>

      <Spec
        name="Band padding"
        source="sections/PageShell.tsx · PageBand"
        used="every subpage band"
        spec="py-16 lg:py-24 · overridden ad hoc on partner (py-0, pb-8, pt-12)"
      >
        <div className="border border-dashed border-black/25 bg-black/[0.03] py-16 text-center lg:py-24">
          <p className={cn(MONO, "text-black/55")}>band</p>
        </div>
      </Spec>
    </Section>
  );
}

function TypeCensus() {
  return (
    <Section title="Type size census">
      <div className="border-t border-black/10 py-6">
        <p className={cn(MONO, "mb-4 max-w-[46rem] text-black/55")}>
          Every distinct font size mockup 6 renders, by how many times it is
          declared. Fifty-one of them, of which twenty-four are used exactly
          once. Sizes a component declares and this version’s classes merge away
          are not counted. This is the drift, counted.
        </p>
        <div className="flex flex-col gap-1">
          {TEXT_SIZE_CENSUS.map((entry) => (
            <div key={entry.size} className="flex items-center gap-3">
              <span
                className={cn(MONO, "w-20 shrink-0 text-right text-black/80")}
              >
                {entry.size}
              </span>
              <span
                className="h-3 rounded-[2px]"
                style={{
                  width: `${entry.count * 14}px`,
                  backgroundColor: LINK_BLUE,
                }}
              />
              <span className={cn(MONO, "text-black/45")}>{entry.count}</span>
            </div>
          ))}
        </div>
        <p className={cn(MONO, "mt-5 max-w-[46rem] text-black/55")}>
          <span className="text-black/80">Used twice each: </span>
          {TWICE_USED_SIZES}
        </p>
        <p className={cn(MONO, "mt-2 max-w-[46rem] text-black/55")}>
          <span className="text-black/80">Used once each: </span>
          {ONE_OFF_SIZES}
        </p>
      </div>
    </Section>
  );
}

export function RedesignSystemPage() {
  return (
    <div
      className="rd-root min-h-screen bg-white text-[var(--rd-ink)]"
      style={themeVars(theme)}
    >
      <div className={cn(RD_COL, "pt-16 pb-32")}>
        <header className="flex flex-col gap-3">
          <p className={cn(MONO, "tracking-widest text-black/40 uppercase")}>
            mockup 6 · not a mockup
          </p>
          <h1 className="rd-headline text-[2.4rem] leading-tight text-[var(--rd-primary)] sm:text-[3rem]">
            Every style in use
          </h1>
          <p className="max-w-[46rem] text-[1.05rem] leading-relaxed text-[var(--rd-ink)]/70">
            Each specimen is the live component, or the literal declaration
            copied from its source. Everything here is something mockup 6 puts
            on screen, across the home page and the nine pages behind the nav.
            The right column says where each one came from and what uses it.
          </p>
        </header>

        <Colours />
        <Faces />
        <Headings />
        <BodyText />
        <Buttons />
        <FormControls />
        <Avatars />
        <Cards />
        <Geometry />
        <TypeCensus />
      </div>
    </div>
  );
}
