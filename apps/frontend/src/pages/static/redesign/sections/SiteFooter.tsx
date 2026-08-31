import { cn } from "@alliance/shared/styles/util";
import { Fragment, type ReactNode } from "react";
import {
  FOOTER_COLUMNS,
  FOOTER_COPYRIGHT,
  FOOTER_LEGAL_LINKS,
  FOOTER_LINKS_FLAT,
  FOOTER_TAGLINE,
  type SiteLink,
} from "../content";
import { rdHref, RedesignPage } from "../links";
import { FooterKind, type RedesignTheme, type RedesignVersion } from "../theme";
import { Logotype, RD_COL, RdArrow, RdTrigger } from "../ui";

const JOIN_MAILTO = `mailto:contact@worldalliance.org?subject=${encodeURIComponent("I'd like to join the Alliance")}`;

function FooterAnchor({
  link,
  theme,
}: {
  link: SiteLink;
  theme: RedesignTheme;
}) {
  const href =
    link.page === RedesignPage.Join
      ? JOIN_MAILTO
      : rdHref(theme.version, link.page);

  return (
    <RdTrigger
      href={href}
      className="-my-2.5 inline-flex items-center gap-1.5 py-2.5 text-white hover:underline"
    >
      {link.label}
      {link.withArrow && <RdArrow className="size-2.5" />}
    </RdTrigger>
  );
}

function LinkColumns({
  theme,
  accountLast = false,
}: {
  theme: RedesignTheme;
  accountLast?: boolean;
}) {
  // The account column is authored first; some footers want it rightmost.
  const [account, ...rest] = FOOTER_COLUMNS;
  const columns = accountLast ? [...rest, account] : FOOTER_COLUMNS;

  return (
    <nav className="flex flex-wrap gap-x-[52px] gap-y-8" aria-label="Footer">
      {columns.map((column) => (
        <ul key={column[0].page} className="flex flex-col gap-1.5">
          {column.map((link) => (
            <li key={link.page}>
              <FooterAnchor link={link} theme={theme} />
            </li>
          ))}
        </ul>
      ))}
    </nav>
  );
}

function InlineLinks({
  theme,
  className,
}: {
  theme: RedesignTheme;
  className?: string;
}) {
  return (
    <nav
      className={cn("flex flex-wrap gap-x-7 gap-y-1", className)}
      aria-label="Footer"
    >
      {FOOTER_LINKS_FLAT.map((link) => (
        <FooterAnchor key={link.page} link={link} theme={theme} />
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
function LegalRow({
  version,
  centered = false,
}: {
  version: RedesignVersion;
  centered?: boolean;
}) {
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
          <Fragment key={link.page}>
            <span aria-hidden>·</span>
            <a
              href={rdHref(version, link.page)}
              className="-my-3 inline-flex items-center py-3 hover:underline"
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
        <LinkColumns theme={theme} />
        <Brand theme={theme} />
      </div>
      <LegalRow version={theme.version} />
    </Shell>
  );
}

/** Versions 2 and 4: brand leads, columns to the right. */
function MirroredFooter({ theme }: { theme: RedesignTheme }) {
  return (
    <Shell>
      <div className="flex flex-col gap-12 lg:flex-row lg:justify-between">
        <Brand theme={theme} />
        <LinkColumns theme={theme} />
      </div>
      <LegalRow version={theme.version} />
    </Shell>
  );
}

/** Version 4: brand right, links left, account column rightmost. */
function ColumnsAccountLastFooter({ theme }: { theme: RedesignTheme }) {
  return (
    <Shell>
      <div className="flex flex-col gap-12 lg:flex-row lg:justify-between">
        <LinkColumns theme={theme} accountLast />
        <Brand theme={theme} />
      </div>
      <LegalRow version={theme.version} />
    </Shell>
  );
}

/** Version 3: everything centred, links on one row. */
function CenteredFooter({ theme }: { theme: RedesignTheme }) {
  return (
    <Shell>
      <div className="flex flex-col items-center gap-7 text-center">
        <Brand theme={theme} className="items-center" />
        <InlineLinks theme={theme} className="justify-center" />
      </div>
      <LegalRow version={theme.version} centered />
    </Shell>
  );
}

/** Brand and links share a line, then the rule and the legal row. */
function InlineFooter({ theme }: { theme: RedesignTheme }) {
  return (
    <Shell>
      <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        <Brand theme={theme} />
        <InlineLinks theme={theme} className="lg:max-w-[30rem] lg:justify-end" />
      </div>
      <LegalRow version={theme.version} />
    </Shell>
  );
}

const footerByKind: Record<
  FooterKind,
  (props: { theme: RedesignTheme }) => ReactNode
> = {
  [FooterKind.Columns]: ColumnsFooter,
  [FooterKind.Mirrored]: MirroredFooter,
  [FooterKind.ColumnsAccountLast]: ColumnsAccountLastFooter,
  [FooterKind.Centered]: CenteredFooter,
  [FooterKind.Inline]: InlineFooter,
};

export function SiteFooter({ theme }: { theme: RedesignTheme }) {
  const Component = footerByKind[theme.footer];
  return <Component theme={theme} />;
}
