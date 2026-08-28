import { href } from "react-router";

export type SiteLink = {
  label: string;
  to: string;
  /** Gets the arrow, marking it as a step out of the site's own pages. */
  withArrow?: boolean;
};

export const PEOPLE_HREF = href("/people");
export const GUIDE_HREF = href("/guide");
export const PROGRESS_HREF = href("/progress");
export const PARTNER_HREF = href("/outreach-partner");
export const JOIN_HREF = href("/join");
export const FAQ_HREF = href("/faq");
export const GOVERNANCE_HREF = href("/governance");
export const FOUNDATION_HREF = href("/foundation");
export const PRIVACY_HREF = href("/privacypolicy");
export const TERMS_HREF = href("/terms");
export const LOGIN_HREF = href("/login");
export const TASKS_HREF = href("/tasks");
export const HOME_HREF = href("/");

export const NAV_LINKS: SiteLink[] = [
  { label: "People", to: PEOPLE_HREF },
  { label: "Guide", to: GUIDE_HREF },
  { label: "Progress", to: PROGRESS_HREF },
];

export const NAV_PARTNER = "Partner with Us";

/**
 * The account column is authored last, which is where this footer wants it.
 */
export const FOOTER_COLUMNS: SiteLink[][] = [
  [
    { label: "People", to: PEOPLE_HREF },
    { label: "Guide", to: GUIDE_HREF },
    { label: "Progress", to: PROGRESS_HREF },
  ],
  [
    { label: "FAQ", to: FAQ_HREF },
    { label: "Governance", to: GOVERNANCE_HREF },
  ],
  [
    { label: "Request to Join", to: JOIN_HREF, withArrow: true },
    { label: "Partner with Us", to: PARTNER_HREF, withArrow: true },
  ],
];

/** Sit on the copyright row, dot-separated. */
export const FOOTER_LEGAL_LINKS: SiteLink[] = [
  { label: "Privacy", to: PRIVACY_HREF },
  { label: "Terms", to: TERMS_HREF },
];
