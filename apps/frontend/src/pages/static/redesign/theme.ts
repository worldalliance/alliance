import type { CSSProperties } from "react";

export enum RedesignVersion {
  V1 = "1",
  V2 = "2",
  V3 = "3",
  V4 = "4",
}

export enum HeroKind {
  Photo = "photo",
  Video = "video",
  Network = "network",
  /** Version 4: notification animation only, no headline. */
  NotificationsOnly = "notifications-only",
}

export enum ModelGraphicKind {
  HoursGrid = "hours-grid",
  GrowthMilestones = "growth-milestones",
}

export enum TestimonialKind {
  /** Marks bracket the column, offset outside it. Matches Landing 1. */
  Bracketed = "bracketed",
  /** Card with the other two quotes angled behind it, plus arrows. */
  Deck = "deck",
  /** Two columns: attribution and button left, oversized quote right. */
  Split = "split",
}

export enum CtaKind {
  /** Full-bleed photo, copy bottom-left, arrow bottom-right. Landing 1. */
  Photo = "photo",
  /** Solid primary panel beside the photo. */
  Split = "split",
  /** Just the photo container and the invite button. */
  Band = "band",
  /** Photo with a solid card overlapping its lower-left corner. */
  OverlapCard = "overlap-card",
}

export enum FooterKind {
  /** Link columns left, logotype right. Landing 1. */
  Columns = "columns",
  /** Logotype left, link columns right. */
  Mirrored = "mirrored",
  /** Everything centred, links in one row. */
  Centered = "centered",
  /** Logotype and links on one line, rule, then the copyright. */
  Inline = "inline",
}

const CASLON = '"Libre Caslon Text", Georgia, serif';
const NEORIS = '"TT Neoris", system-ui, sans-serif';
const GALDEANO = '"Galdeano", Georgia, serif';

const DEEP_BLUE = "#081E40";
const DEEP_BLUE_HOVER = "#0d2c5c";
const DEEP_GREEN = "#11301F";
const DEEP_GREEN_HOVER = "#1b4530";

/**
 * The priority row alternates blue and green in every mockup, including the
 * green-primary ones, so these do not follow the theme.
 */
export const PRIORITY_TINTS = [DEEP_BLUE, DEEP_GREEN] as const;

export type RedesignTheme = {
  version: RedesignVersion;
  /** h2, primary buttons, footer, and the photo overlays. */
  primary: string;
  primaryHover: string;
  surface: string;
  /** The band behind the priority row and the "how does it work" section. */
  surfaceAlt: string;
  ink: string;
  fontBody: string;
  fontDisplay: string;
  logotypeWeight: number;
  logotypeUppercase: boolean;
  logotypeTracking: string;
  /** Version 4 drops the article, leaving just "Alliance". */
  logotypeArticle: boolean;
  /** Whether the h1 uses the display face or the body face. */
  headlineFont: string;
  headlineWeight: number;
  /** Buttons only. Pill in version 3, slightly rounded elsewhere. */
  radiusButton: string;
  /** Cards, panels, and photo tiles. Never a pill, or tiles become circles. */
  radiusCard: string;
  radiusInput: string;
  centeredLayout: boolean;
  hero: HeroKind;
  /**
   * Version 4's hero is the notification animation alone, so the headline moves
   * into a block below it. Versions 1 to 3 carry the headline in the hero.
   */
  showHeadlineIntro: boolean;
  /** Hero notification cards drop their chrome everywhere but version 4. */
  notificationsBare: boolean;
  modelGraphic: ModelGraphicKind;
  testimonial: TestimonialKind;
  cta: CtaKind;
  footer: FooterKind;
};

const SURFACE = "#f7f7f6";
const SURFACE_ALT = "#e4e5e3";
const INK = "#14181d";

export const redesignThemes = {
  [RedesignVersion.V1]: {
    version: RedesignVersion.V1,
    primary: DEEP_BLUE,
    primaryHover: DEEP_BLUE_HOVER,
    surface: SURFACE,
    surfaceAlt: SURFACE_ALT,
    ink: INK,
    fontBody: NEORIS,
    fontDisplay: CASLON,
    logotypeWeight: 600,
    logotypeUppercase: true,
    logotypeTracking: "0.02em",
    logotypeArticle: true,
    headlineFont: CASLON,
    headlineWeight: 400,
    radiusButton: "0.375rem",
    radiusCard: "0.75rem",
    radiusInput: "0.375rem",
    centeredLayout: false,
    hero: HeroKind.Photo,
    showHeadlineIntro: false,
    notificationsBare: true,
    modelGraphic: ModelGraphicKind.HoursGrid,
    testimonial: TestimonialKind.Bracketed,
    cta: CtaKind.Photo,
    footer: FooterKind.Columns,
  },
  [RedesignVersion.V2]: {
    version: RedesignVersion.V2,
    primary: DEEP_GREEN,
    primaryHover: DEEP_GREEN_HOVER,
    surface: SURFACE,
    surfaceAlt: SURFACE_ALT,
    ink: INK,
    fontBody: NEORIS,
    fontDisplay: CASLON,
    logotypeWeight: 700,
    logotypeUppercase: false,
    logotypeTracking: "0",
    logotypeArticle: true,
    headlineFont: NEORIS,
    headlineWeight: 400,
    radiusButton: "0.375rem",
    radiusCard: "0.75rem",
    radiusInput: "0.375rem",
    centeredLayout: false,
    hero: HeroKind.Video,
    showHeadlineIntro: false,
    notificationsBare: true,
    modelGraphic: ModelGraphicKind.GrowthMilestones,
    testimonial: TestimonialKind.Deck,
    cta: CtaKind.Split,
    footer: FooterKind.Mirrored,
  },
  [RedesignVersion.V3]: {
    version: RedesignVersion.V3,
    primary: DEEP_GREEN,
    primaryHover: DEEP_GREEN_HOVER,
    surface: SURFACE,
    surfaceAlt: SURFACE_ALT,
    ink: INK,
    fontBody: NEORIS,
    fontDisplay: GALDEANO,
    logotypeWeight: 400,
    logotypeUppercase: false,
    logotypeTracking: "0",
    logotypeArticle: true,
    headlineFont: GALDEANO,
    headlineWeight: 600,
    radiusButton: "9999px",
    radiusCard: "0.75rem",
    radiusInput: "9999px",
    centeredLayout: true,
    hero: HeroKind.Network,
    showHeadlineIntro: false,
    notificationsBare: true,
    modelGraphic: ModelGraphicKind.GrowthMilestones,
    testimonial: TestimonialKind.Split,
    cta: CtaKind.Band,
    footer: FooterKind.Centered,
  },
  [RedesignVersion.V4]: {
    version: RedesignVersion.V4,
    primary: DEEP_BLUE,
    primaryHover: DEEP_BLUE_HOVER,
    surface: SURFACE,
    surfaceAlt: SURFACE_ALT,
    ink: INK,
    fontBody: NEORIS,
    fontDisplay: CASLON,
    logotypeWeight: 700,
    logotypeUppercase: false,
    logotypeTracking: "0.02em",
    logotypeArticle: false,
    headlineFont: CASLON,
    headlineWeight: 400,
    radiusButton: "0.375rem",
    radiusCard: "0.75rem",
    radiusInput: "0.375rem",
    centeredLayout: false,
    hero: HeroKind.NotificationsOnly,
    showHeadlineIntro: true,
    notificationsBare: false,
    modelGraphic: ModelGraphicKind.GrowthMilestones,
    testimonial: TestimonialKind.Bracketed,
    cta: CtaKind.Photo,
    footer: FooterKind.Mirrored,
  },
} as const satisfies Record<RedesignVersion, RedesignTheme>;

export const redesignVersions: RedesignVersion[] = [
  RedesignVersion.V1,
  RedesignVersion.V2,
  RedesignVersion.V3,
  RedesignVersion.V4,
];

/** The bar starts light only where a photo or video sits behind it. */
export const navStartsOnDark: Record<HeroKind, boolean> = {
  [HeroKind.Photo]: true,
  [HeroKind.Video]: true,
  [HeroKind.Network]: false,
  [HeroKind.NotificationsOnly]: false,
};

export function parseVersion(raw: string | null): RedesignVersion {
  return redesignVersions.find((v) => String(v) === raw) ?? RedesignVersion.V1;
}

interface ThemeVars extends CSSProperties {
  "--rd-primary": string;
  "--rd-primary-hover": string;
  "--rd-surface": string;
  "--rd-surface-alt": string;
  "--rd-ink": string;
  "--rd-font-body": string;
  "--rd-font-display": string;
  "--rd-font-headline": string;
  "--rd-radius-button": string;
  "--rd-radius-card": string;
  "--rd-radius-input": string;
}

export function themeVars(theme: RedesignTheme): ThemeVars {
  return {
    "--rd-primary": theme.primary,
    "--rd-primary-hover": theme.primaryHover,
    "--rd-surface": theme.surface,
    "--rd-surface-alt": theme.surfaceAlt,
    "--rd-ink": theme.ink,
    "--rd-font-body": theme.fontBody,
    "--rd-font-display": theme.fontDisplay,
    "--rd-font-headline": theme.headlineFont,
    "--rd-radius-button": theme.radiusButton,
    "--rd-radius-card": theme.radiusCard,
    "--rd-radius-input": theme.radiusInput,
  };
}
