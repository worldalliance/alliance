import type { CSSProperties } from "react";

/**
 * The palette, faces, and radii of the public site. Every band, card, and
 * control reads them through the CSS variables {@link siteVars} sets on the
 * page root, so a value only appears literally where a component needs a
 * colour the page's own theme does not carry.
 */

const CASLON = '"Libre Caslon Text", Georgia, serif';
const NEORIS = '"TT Neoris", system-ui, sans-serif';

export const DEEP_BLUE = "#081E40";
const DEEP_BLUE_HOVER = "#0d2c5c";
const DEEP_GREEN = "#11301F";

/** For a panel that has to sit apart from the primary bands around it. */
export const PANEL_GREEN = DEEP_GREEN;

/** The priority row alternates blue and green, four cards over two tints. */
export const PRIORITY_TINTS = [DEEP_BLUE, DEEP_GREEN] as const;

/** The link blue: low-emphasis buttons, feed action links, member counts. */
export const LINK_BLUE = "#1E68D9";

const SURFACE = "#f7f7f6";
const SURFACE_ALT = "#e4e5e3";
const INK = "#14181d";

interface SiteVars extends CSSProperties {
  "--site-primary": string;
  "--site-primary-hover": string;
  "--site-surface": string;
  "--site-surface-alt": string;
  "--site-ink": string;
  "--site-font-body": string;
  "--site-font-display": string;
  "--site-radius-button": string;
  "--site-radius-card": string;
  "--site-radius-input": string;
}

export const siteVars: SiteVars = {
  "--site-primary": DEEP_BLUE,
  "--site-primary-hover": DEEP_BLUE_HOVER,
  "--site-surface": SURFACE,
  "--site-surface-alt": SURFACE_ALT,
  "--site-ink": INK,
  "--site-font-body": NEORIS,
  "--site-font-display": CASLON,
  "--site-radius-button": "0.375rem",
  "--site-radius-card": "0.75rem",
  "--site-radius-input": "0.375rem",
};

/** The h1 and the priority headings, which take the display face. */
export const HEADLINE_WEIGHT = 400;
