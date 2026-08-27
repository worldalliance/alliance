import type { RedesignVersion } from "./theme";

/**
 * Every page the mockups link to. The home page is `/redesign`; the rest hang
 * off it, so a mockup can be browsed as a whole site rather than one screen.
 */
export enum RedesignPage {
  Home = "home",
  People = "people",
  Guide = "guide",
  Progress = "progress",
  Partner = "partner",
  Join = "join",
  Faq = "faq",
  Governance = "governance",
  Foundation = "foundation",
  Privacy = "privacy",
  Terms = "terms",
}

/** The `:page` segment each one sits at. Home has none. */
const pageSlugs: Record<RedesignPage, string> = {
  [RedesignPage.Home]: "",
  [RedesignPage.People]: "people",
  [RedesignPage.Guide]: "guide",
  [RedesignPage.Progress]: "progress",
  [RedesignPage.Partner]: "partner",
  [RedesignPage.Join]: "join",
  [RedesignPage.Faq]: "faq",
  [RedesignPage.Governance]: "governance",
  [RedesignPage.Foundation]: "foundation",
  [RedesignPage.Privacy]: "privacy",
  [RedesignPage.Terms]: "terms",
};

/** The version travels in `?v=`, so every internal link has to carry it on. */
export function rdHref(version: RedesignVersion, page: RedesignPage): string {
  const slug = pageSlugs[page];
  return slug ? `/redesign/${slug}?v=${version}` : `/redesign?v=${version}`;
}

/** Anything unrecognised falls back to the home page, as `parseVersion` does. */
export function parsePage(raw: string | undefined): RedesignPage {
  const match = Object.values(RedesignPage).find(
    (page) => pageSlugs[page] !== "" && pageSlugs[page] === raw,
  );
  return match ?? RedesignPage.Home;
}

/**
 * A control that either navigates or opens something in place. Version 4 puts
 * the join form in a modal, so its join buttons carry `onClick` where the other
 * versions carry `href`.
 */
export type LinkTarget = { href: string } | { onClick: () => void };

/** Pages outside the mockups, which the real site already serves. */
export const LOGIN_HREF = "/login";
