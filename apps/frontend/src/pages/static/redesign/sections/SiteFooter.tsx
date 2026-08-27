import { cn } from "@alliance/shared/styles/util";
import { Fragment, type ReactNode } from "react";
import {
  FOOTER_COLUMNS,
  FOOTER_COPYRIGHT,
  FOOTER_LEGAL_LINKS,
  FOOTER_LINKS_FLAT,
  FOOTER_TAGLINE,
  type FooterLink,
} from "../content";
import { FooterKind, type RedesignTheme } from "../theme";
import { Logotype, RD_COL, RdArrow } from "../ui";

function FooterAnchor({ link }: { link: FooterLink }) {
  return (
    <a
      href={link.href}
      className="inline-flex min-h-11 items-center gap-1.5 text-white hover:underline"
    >
      {link.label}
      {link.external && <RdArrow className="size-2.5" />}
    </a>
  );
}

function LinkColumns() {
  return (
    <nav className="flex flex-wrap gap-x-[52px] gap-y-8" aria-label="Footer">
      {FOOTER_COLUMNS.map((column) => (
        <ul key={column[0].href} className="flex flex-col gap-0.5 sm:gap-[13px]">
          {column.map((link) => (
            <li key={link.href}>
              <FooterAnchor link={link} />
            </li>
          ))}
        </ul>
      ))}
    </nav>
  );
}

function InlineLinks({ className }: { className?: string }) {
  return (
    <nav
      className={cn("flex flex-wrap gap-x-7 gap-y-3", className)}
      aria-label="Footer"
    >
      {FOOTER_LINKS_FLAT.map((link) => (
        <FooterAnchor key={link.href} link={link} />
      ))}
    </nav>
  );
}

function Brand({
  theme,
  className,
}: {
  theme: RedesignTheme;
  className?: string;
}) {
  return (
    <div className={cn("flex max-w-[28rem] flex-col gap-1.5", className)}>
      <span className="text-[2.1rem] leading-none">
        <Logotype theme={theme} onDark />
      </span>
      <p className="font-normal text-white/90">{FOOTER_TAGLINE}</p>
    </div>
  );
}

/** Copyright and the legal links share one dot-separated row under a rule. */
function LegalRow({ centered = false }: { centered?: boolean }) {
  return (
    <div className="mt-14 border-t border-white/15 pt-6">
      <p
        className={cn(
          "flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/60",
          centered && "justify-center",
        )}
      >
        <span>{FOOTER_COPYRIGHT}</span>
        {FOOTER_LEGAL_LINKS.map((link) => (
          <Fragment key={link.href}>
            <span aria-hidden>·</span>
            <a
              href={link.href}
              className="inline-flex min-h-11 items-center hover:underline"
            >
              {link.label}
            </a>
          </Fragment>
        ))}
      </p>
    </div>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <footer className="bg-[var(--rd-primary)] text-white">
      <div className={cn(RD_COL, "pt-24 pb-10")}>{children}</div>
    </footer>
  );
}

/** Landing 1: link columns left, brand right. */
function ColumnsFooter({ theme }: { theme: RedesignTheme }) {
  return (
    <Shell>
      <div className="flex flex-col gap-12 lg:flex-row lg:justify-between">
        <LinkColumns />
        <Brand theme={theme} />
      </div>
      <LegalRow />
    </Shell>
  );
}

/** Versions 2 and 4: brand leads, columns to the right. */
function MirroredFooter({ theme }: { theme: RedesignTheme }) {
  return (
    <Shell>
      <div className="flex flex-col gap-12 lg:flex-row lg:justify-between">
        <Brand theme={theme} />
        <LinkColumns />
      </div>
      <LegalRow />
    </Shell>
  );
}

/** Version 3: everything centred, links on one row. */
function CenteredFooter({ theme }: { theme: RedesignTheme }) {
  return (
    <Shell>
      <div className="flex flex-col items-center gap-7 text-center">
        <Brand theme={theme} className="items-center" />
        <InlineLinks className="justify-center" />
      </div>
      <LegalRow centered />
    </Shell>
  );
}

/** Brand and links share a line, then the rule and the legal row. */
function InlineFooter({ theme }: { theme: RedesignTheme }) {
  return (
    <Shell>
      <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        <Brand theme={theme} />
        <InlineLinks className="lg:max-w-[30rem] lg:justify-end" />
      </div>
      <LegalRow />
    </Shell>
  );
}

const footerByKind: Record<
  FooterKind,
  (props: { theme: RedesignTheme }) => ReactNode
> = {
  [FooterKind.Columns]: ColumnsFooter,
  [FooterKind.Mirrored]: MirroredFooter,
  [FooterKind.Centered]: CenteredFooter,
  [FooterKind.Inline]: InlineFooter,
};

export function SiteFooter({ theme }: { theme: RedesignTheme }) {
  const Component = footerByKind[theme.footer];
  return <Component theme={theme} />;
}
