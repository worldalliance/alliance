import { cn } from "@alliance/shared/styles/util";
import { Fragment } from "react";
import { Link } from "react-router";
import { CONTACT_EMAIL, FOOTER_TAGLINE } from "./content";
import { FOOTER_COLUMNS, FOOTER_LEGAL_LINKS, type SiteLink } from "./links";
import { Logotype, SITE_COL, SiteArrow, TexturedFill } from "./ui";

function FooterAnchor({ link }: { link: SiteLink }) {
  return (
    <Link
      to={link.to}
      className="-my-2.5 inline-flex items-center gap-1.5 py-2.5 text-white hover:underline"
    >
      {link.label}
      {link.withArrow && <SiteArrow className="size-2.5" />}
    </Link>
  );
}

/** Copyright, the legal links, and the contact address share one dotted row. */
function LegalRow() {
  return (
    <div className="mt-14 border-t border-white/15 pt-6">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/60">
        <span>{`© ${new Date().getFullYear()} Alliance Foundation`}</span>
        {FOOTER_LEGAL_LINKS.map((link) => (
          <Fragment key={link.to}>
            <span aria-hidden>·</span>
            <Link
              to={link.to}
              className="-my-3 inline-flex items-center py-3 hover:underline"
            >
              {link.label}
            </Link>
          </Fragment>
        ))}
        <span aria-hidden>·</span>
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="-my-3 inline-flex items-center py-3 hover:underline"
        >
          {CONTACT_EMAIL}
        </a>
      </p>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="relative isolate overflow-hidden bg-[var(--site-primary)] text-white">
      <TexturedFill />
      <div className={cn(SITE_COL, "relative z-10 pt-16 pb-10 lg:pt-24")}>
        <div className="flex flex-col gap-12 lg:flex-row lg:justify-between">
          <nav
            className="flex flex-wrap gap-x-[52px] gap-y-8"
            aria-label="Footer"
          >
            {FOOTER_COLUMNS.map((column) => (
              <ul key={column[0].to} className="flex flex-col gap-1.5">
                {column.map((link) => (
                  <li key={link.to}>
                    <FooterAnchor link={link} />
                  </li>
                ))}
              </ul>
            ))}
          </nav>
          <div className="flex max-w-[28rem] flex-col gap-1.5">
            <span className="text-[2.1rem] leading-none">
              <Logotype onDark />
            </span>
            <p className="font-normal text-white/90">{FOOTER_TAGLINE}</p>
          </div>
        </div>
        <LegalRow />
      </div>
    </footer>
  );
}
