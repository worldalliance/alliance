import { cn } from "@alliance/shared/styles/util";
import React from "react";
import { Link, href } from "react-router";
import { LANDING_QUOTES_COL } from "../pages/static/prelaunchLayout";

interface FooterProps {
  className?: string;
}

const EXPLORE_LINKS = [
  { label: "People", to: href("/people") },
  { label: "Guide", to: href("/guide") },
  { label: "Progress", to: href("/progress") },
] as const;

const JOIN_LINKS = [
  { label: "Partner", to: href("/outreach-partner") },
  { label: "Log in", to: href("/login") },
  { label: "Governance", to: href("/governance") },
] as const;

const LEGAL_LINKS = [
  { label: "FAQ", to: href("/faq") },
  { label: "Privacy", to: href("/privacypolicy") },
  { label: "Terms", to: href("/terms") },
] as const;

function FooterLinkGroup({ children }: { children: React.ReactNode }) {
  return <ul className="flex flex-col gap-2">{children}</ul>;
}

function FooterLink({ to, label }: { to: string; label: string }) {
  return (
    <li>
      <Link
        to={to}
        className="text-sm text-white/85 hover:underline sm:text-base"
      >
        {label}
      </Link>
    </li>
  );
}

const Footer: React.FC<FooterProps> = ({ className }) => {
  return (
    <footer className={cn("w-full bg-black text-white", className)}>
      <div className={cn(LANDING_QUOTES_COL, "py-10 md:py-12")}>
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="flex max-w-sm flex-col gap-3">
            <p className="font-berlingske text-lg font-bold tracking-wide md:text-xl">
              THE ALLIANCE
            </p>
            <p className="text-base leading-relaxed text-white/70 sm:text-lg">
              A global group of people cooperating to improve the world.
            </p>
          </div>

          <nav
            className="flex flex-col gap-8 sm:flex-row sm:flex-wrap sm:gap-12 md:gap-16"
            aria-label="Footer"
          >
            <FooterLinkGroup>
              {EXPLORE_LINKS.map((link) => (
                <FooterLink key={link.to} {...link} />
              ))}
            </FooterLinkGroup>
            <FooterLinkGroup>
              {JOIN_LINKS.map((link) => (
                <FooterLink key={link.to} {...link} />
              ))}
            </FooterLinkGroup>
            <FooterLinkGroup>
              {LEGAL_LINKS.map((link) => (
                <FooterLink key={link.to} {...link} />
              ))}
            </FooterLinkGroup>
            <FooterLinkGroup>
              <li>
                <a
                  href="mailto:contact@worldalliance.org"
                  className="text-sm text-white/85 hover:underline sm:text-base"
                >
                  contact@worldalliance.org
                </a>
              </li>
            </FooterLinkGroup>
          </nav>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <p className="text-sm text-white/40">
            &copy; {new Date().getFullYear()} Alliance Foundation
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
