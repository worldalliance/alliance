import { cn } from "@alliance/shared/styles/util";
import type { ReactNode } from "react";
import membersPhoto from "../../../../assets/redesign/members-photo.webp";
import { CTA_BODY, CTA_BUTTON } from "../content";
import { CtaKind, type RedesignTheme } from "../theme";
import { RD_COL, RdArrow, RdButton, RdTrigger } from "../ui";
import { useJoinTarget } from "./JoinRequest";

/** How far the artwork hangs over the footer, measured off the Figma. */
const FOOTER_OVERLAP = 54;

function Photo({ className }: { className?: string }) {
  return (
    <img
      src={membersPhoto}
      alt="Alliance members at a meetup"
      className={cn("size-full object-cover", className)}
    />
  );
}

function Heading({
  theme,
  className,
}: {
  theme: RedesignTheme;
  className?: string;
}) {
  return (
    <h2 className={cn("leading-none font-normal", className)}>
      {theme.joinLabel}
    </h2>
  );
}

/** Wraps a variant, painting the footer colour behind the overhanging edge. */
function CtaShell({
  children,
  overlap = true,
}: {
  children: ReactNode;
  overlap?: boolean;
}) {
  return (
    <section id="join" className="relative bg-[var(--rd-surface)]">
      {overlap && (
        <div
          className="absolute inset-x-0 bottom-0 bg-[var(--rd-primary)]"
          style={{ height: FOOTER_OVERLAP }}
          aria-hidden
        />
      )}
      <div className={cn(RD_COL, "relative")}>{children}</div>
    </section>
  );
}

/** Landing 1: copy bottom-left over the photo, arrow bottom-right. */
function PhotoCta({
  theme,
  short = false,
}: {
  theme: RedesignTheme;
  short?: boolean;
}) {
  const target = useJoinTarget(theme.version);

  return (
    <CtaShell>
      <RdTrigger
        {...target}
        ariaLabel={CTA_BUTTON}
        className="group relative isolate block w-full overflow-hidden"
        style={{ borderRadius: "var(--rd-radius-card)" }}
      >
        <Photo className="absolute inset-0 -z-20 transition-transform duration-[900ms] ease-out group-hover:scale-[1.06]" />
        <div
          className="absolute inset-0 -z-10 opacity-[0.42] transition-opacity duration-700 group-hover:opacity-[0.28]"
          style={{ backgroundColor: "var(--rd-primary)" }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-3 border border-[#1E68D9]/0 transition-colors duration-500 group-hover:border-[#1E68D9]"
          style={{ borderRadius: "var(--rd-radius-card)" }}
          aria-hidden
        />
        <div
          className={cn(
            "flex flex-col justify-end p-8 text-white sm:p-10",
            short
              ? "min-h-[315px] sm:min-h-[420px]"
              : "min-h-[420px] sm:min-h-[560px]",
          )}
        >
          <Heading theme={theme} className="text-[3.1rem] sm:text-[3.6rem]" />
          <p className="mt-3 max-w-[40rem] text-lg leading-snug font-light sm:text-[1.35rem]">
            {CTA_BODY}
          </p>
        </div>
        <span className="absolute right-8 bottom-8 sm:right-10 sm:bottom-9">
          <RdArrow className="size-6 text-white transition-transform duration-500 ease-out group-hover:translate-x-2 group-hover:-translate-y-2 group-hover:scale-110" />
        </span>
      </RdTrigger>
    </CtaShell>
  );
}

/** Version 2: a solid primary panel beside the photo, inside a white stroke. */
function SplitCtaLayout({
  theme,
  reversed,
}: {
  theme: RedesignTheme;
  reversed: boolean;
}) {
  const target = useJoinTarget(theme.version);
  const photo = (
    <div className="relative min-h-[300px] lg:min-h-[520px]">
      <Photo className="absolute inset-0" />
    </div>
  );
  const panel = (
    <div className="flex flex-col justify-center gap-6 bg-[var(--rd-primary)] p-9 text-white sm:p-12">
      <Heading theme={theme} className="text-[2.8rem] sm:text-[3.2rem]" />
      <p className="-mt-2 text-lg leading-snug font-light sm:text-[1.25rem]">
        {CTA_BODY}
      </p>
      <RdButton {...target} tone="light" className="w-fit" withArrow>
        {CTA_BUTTON}
      </RdButton>
    </div>
  );

  return (
    <CtaShell>
      <div
        className={cn(
          "grid overflow-hidden border-2 border-white",
          reversed ? "lg:grid-cols-[5fr_7fr]" : "lg:grid-cols-[7fr_5fr]",
        )}
        style={{ borderRadius: "var(--rd-radius-card)" }}
      >
        {reversed ? (
          <>
            {panel}
            {photo}
          </>
        ) : (
          <>
            {photo}
            {panel}
          </>
        )}
      </div>
    </CtaShell>
  );
}

function SplitCta({ theme }: { theme: RedesignTheme }) {
  return <SplitCtaLayout theme={theme} reversed={false} />;
}

/** Version 3: the photo container and the invite button, nothing else. */
function BandCta({ theme }: { theme: RedesignTheme }) {
  const target = useJoinTarget(theme.version);

  return (
    <CtaShell>
      <RdTrigger
        {...target}
        ariaLabel={CTA_BUTTON}
        className="group relative isolate flex min-h-[340px] w-full items-center justify-center overflow-hidden border-2 border-white sm:min-h-[440px]"
        style={{ borderRadius: "var(--rd-radius-card)" }}
      >
        <Photo className="absolute inset-0 -z-20 transition-transform duration-[900ms] ease-out group-hover:scale-[1.06]" />
        <div
          className="absolute inset-0 -z-10 opacity-[0.38] transition-opacity duration-700 group-hover:opacity-[0.24]"
          style={{ backgroundColor: "var(--rd-primary)" }}
          aria-hidden
        />
        <span
          className="inline-flex items-center gap-2 bg-white px-7 py-3.5 text-base font-medium text-[var(--rd-primary)] transition-transform duration-300 ease-out group-hover:-translate-y-0.5 group-hover:shadow-[0_12px_26px_-14px_rgba(0,0,0,0.6)]"
          style={{ borderRadius: "var(--rd-radius-button)" }}
        >
          {CTA_BUTTON}
          <RdArrow className="size-3 transition-transform duration-300 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </span>
      </RdTrigger>
    </CtaShell>
  );
}

/** Version 4: a solid card overlapping the lower-left corner of the photo. */
function OverlapCardCta({ theme }: { theme: RedesignTheme }) {
  const target = useJoinTarget(theme.version);

  return (
    <CtaShell>
      <div className="relative pb-14 lg:pb-0">
        <div
          className="relative isolate ml-auto min-h-[340px] w-full overflow-hidden lg:min-h-[480px] lg:w-[82%]"
          style={{ borderRadius: "var(--rd-radius-card)" }}
        >
          <Photo className="absolute inset-0 -z-20" />
          <div
            className="absolute inset-0 -z-10"
            style={{ backgroundColor: "var(--rd-primary)", opacity: 0.3 }}
            aria-hidden
          />
        </div>
        <div
          className="relative -mt-16 flex w-full flex-col gap-5 bg-[var(--rd-primary)] p-8 text-white sm:p-10 lg:absolute lg:bottom-16 lg:left-0 lg:-mt-0 lg:w-[46%]"
          style={{ borderRadius: "var(--rd-radius-card)" }}
        >
          <Heading theme={theme} className="text-[2.7rem] sm:text-[3.1rem]" />
          <p className="-mt-2 text-lg leading-snug font-light sm:text-[1.2rem]">
            {CTA_BODY}
          </p>
          <RdButton
            {...target}
            tone="outlineLight"
            className="w-fit"
            withArrow
          >
            {CTA_BUTTON}
          </RdButton>
        </div>
      </div>
    </CtaShell>
  );
}

const ctaByKind: Record<
  CtaKind,
  (props: { theme: RedesignTheme }) => ReactNode
> = {
  [CtaKind.Photo]: PhotoCta,
  [CtaKind.PhotoShort]: (props) => <PhotoCta {...props} short />,
  [CtaKind.Split]: SplitCta,
  [CtaKind.Band]: BandCta,
  [CtaKind.OverlapCard]: OverlapCardCta,
};

export function JoinCta({ theme }: { theme: RedesignTheme }) {
  const Component = ctaByKind[theme.cta];
  return <Component theme={theme} />;
}
