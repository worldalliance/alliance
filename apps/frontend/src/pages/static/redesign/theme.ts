import type { CSSProperties } from "react";

export enum RedesignVersion {
  V1 = "1",
  V2 = "2",
  V3 = "3",
  V4 = "4",
  V5 = "5",
  V6 = "6",
  V7 = "7",
}

export enum HeroKind {
  Photo = "photo",
  Video = "video",
  Network = "network",
  /** Version 4: notification animation only, no headline. */
  NotificationsOnly = "notifications-only",
  /** Version 5: a row of posts across the top, headline below. Landing 5. */
  PostsMarquee = "posts-marquee",
  /** Version 6: headline left, posts clustered beside it. Landing 6. */
  PostsCollage = "posts-collage",
  /** Version 7: centred headline over a panel the posts flank. Landing 7. */
  PostsSpotlight = "posts-spotlight",
}

export enum ModelGraphicKind {
  HoursGrid = "hours-grid",
  GrowthMilestones = "growth-milestones",
}

export enum ProductCardKind {
  /** Types the pledge out, three task steps, long outcome title. */
  Typed = "typed",
  /** States the pledge and signs it, one task step with progress, post slides in. */
  Signature = "signature",
}

export enum TestimonialKind {
  /** Marks bracket the column, offset outside it. Matches Landing 1. */
  Bracketed = "bracketed",
  /** Card with the other two quotes angled behind it, plus arrows. */
  Deck = "deck",
  /** As above, but the closing mark sits beside the text, not below it. */
  BracketedInline = "bracketed-inline",
  /** Two columns: attribution and button left, oversized quote right. */
  Split = "split",
}

export enum CtaKind {
  /** Full-bleed photo, copy bottom-left, arrow bottom-right. Landing 1. */
  Photo = "photo",
  /** As above, a quarter shorter. */
  PhotoShort = "photo-short",
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
  /** As Columns, but the Log In / Partner column sits rightmost. */
  ColumnsAccountLast = "columns-account-last",
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

/** For a panel that has to sit apart from the primary bands around it. */
export const PANEL_GREEN = DEEP_GREEN;

/** The link blue: low-emphasis buttons, progress, checks, and inline links. */
export const LINK_BLUE = "#1E68D9";

export type RedesignTheme = {
  version: RedesignVersion;
  /** h2, primary buttons, footer, and the photo overlays. */
  primary: string;
  primaryHover: string;
  /** Progress, checks, links, and the low-emphasis buttons. */
  accent: string;
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
  /** The hero button and the closing CTA headline share this. */
  joinLabel: string;
  hero: HeroKind;
  /**
   * Set where the hero carries no headline, which moves the h1 into a block
   * below it. Versions 4 and 5.
   */
  showHeadlineIntro: boolean;
  /** Hero notification cards drop their chrome everywhere but version 4. */
  notificationsBare: boolean;
  modelGraphic: ModelGraphicKind;
  productCards: ProductCardKind;
  testimonial: TestimonialKind;
  /** A short framing line under the priority row. */
  showPrioritiesNote: boolean;
  cta: CtaKind;
  footer: FooterKind;
};

const SURFACE = "#f7f7f6";
const SURFACE_ALT = "#e4e5e3";
const INK = "#14181d";

/** Versions 4 to 7 share everything but the hero, so they build on this. */
const V4_BASE = {
  primary: DEEP_BLUE,
  primaryHover: DEEP_BLUE_HOVER,
  accent: DEEP_BLUE,
  surface: SURFACE,
  surfaceAlt: SURFACE_ALT,
  ink: INK,
  fontBody: NEORIS,
  fontDisplay: CASLON,
  logotypeWeight: 500,
  logotypeUppercase: false,
  logotypeTracking: "0.02em",
  logotypeArticle: true,
  headlineFont: CASLON,
  headlineWeight: 400,
  radiusButton: "0.375rem",
  radiusCard: "0.75rem",
  radiusInput: "0.375rem",
  centeredLayout: false,
  joinLabel: "Join us",
  hero: HeroKind.NotificationsOnly,
  showHeadlineIntro: true,
  notificationsBare: false,
  modelGraphic: ModelGraphicKind.GrowthMilestones,
  productCards: ProductCardKind.Signature,
  testimonial: TestimonialKind.BracketedInline,
  showPrioritiesNote: true,
  cta: CtaKind.Photo,
  footer: FooterKind.ColumnsAccountLast,
} satisfies Omit<RedesignTheme, "version">;

export const redesignThemes = {
  [RedesignVersion.V1]: {
    version: RedesignVersion.V1,
    primary: DEEP_BLUE,
    primaryHover: DEEP_BLUE_HOVER,
    accent: DEEP_BLUE,
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
    joinLabel: "Request to join",
    hero: HeroKind.Photo,
    showHeadlineIntro: false,
    notificationsBare: true,
    modelGraphic: ModelGraphicKind.HoursGrid,
    productCards: ProductCardKind.Typed,
    testimonial: TestimonialKind.Bracketed,
    showPrioritiesNote: false,
    cta: CtaKind.Photo,
    footer: FooterKind.Columns,
  },
  [RedesignVersion.V2]: {
    version: RedesignVersion.V2,
    primary: DEEP_GREEN,
    primaryHover: DEEP_GREEN_HOVER,
    accent: DEEP_GREEN,
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
    joinLabel: "Request to join",
    hero: HeroKind.Video,
    showHeadlineIntro: false,
    notificationsBare: true,
    modelGraphic: ModelGraphicKind.GrowthMilestones,
    productCards: ProductCardKind.Typed,
    testimonial: TestimonialKind.Deck,
    showPrioritiesNote: false,
    cta: CtaKind.Split,
    footer: FooterKind.Mirrored,
  },
  [RedesignVersion.V3]: {
    version: RedesignVersion.V3,
    primary: DEEP_GREEN,
    primaryHover: DEEP_GREEN_HOVER,
    accent: DEEP_GREEN,
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
    joinLabel: "Request to join",
    hero: HeroKind.Network,
    showHeadlineIntro: false,
    notificationsBare: true,
    modelGraphic: ModelGraphicKind.GrowthMilestones,
    productCards: ProductCardKind.Typed,
    testimonial: TestimonialKind.Split,
    showPrioritiesNote: false,
    cta: CtaKind.Band,
    footer: FooterKind.Centered,
  },
  [RedesignVersion.V4]: { ...V4_BASE, version: RedesignVersion.V4 },
  /**
   * Versions 5 to 7 are version 4 with a different hero, so they are spread
   * from it. Each one is a way of putting member activity above the fold.
   */
  [RedesignVersion.V5]: {
    ...V4_BASE,
    version: RedesignVersion.V5,
    joinLabel: "Request to join",
    hero: HeroKind.PostsMarquee,
    showHeadlineIntro: true,
  },
  [RedesignVersion.V6]: {
    ...V4_BASE,
    version: RedesignVersion.V6,
    joinLabel: "Request to join",
    cta: CtaKind.PhotoShort,
    hero: HeroKind.PostsCollage,
    showHeadlineIntro: false,
  },
  [RedesignVersion.V7]: {
    ...V4_BASE,
    version: RedesignVersion.V7,
    accent: LINK_BLUE,
    joinLabel: "Request to join",
    cta: CtaKind.PhotoShort,
    hero: HeroKind.PostsSpotlight,
    showHeadlineIntro: false,
  },
} as const satisfies Record<RedesignVersion, RedesignTheme>;

export const redesignVersions: RedesignVersion[] = [
  RedesignVersion.V1,
  RedesignVersion.V2,
  RedesignVersion.V3,
  RedesignVersion.V4,
  RedesignVersion.V5,
  RedesignVersion.V6,
  RedesignVersion.V7,
];

/** What the bar sits over before the page scrolls. */
export enum NavStart {
  /** The page surface: dark type, primary buttons. */
  Surface = "surface",
  /** A photo or video, so the type inverts but the buttons hold up. */
  Media = "media",
  /** A solid primary band, where a primary button would disappear. */
  Primary = "primary",
}

export const navStart: Record<HeroKind, NavStart> = {
  [HeroKind.Photo]: NavStart.Media,
  [HeroKind.Video]: NavStart.Media,
  [HeroKind.Network]: NavStart.Surface,
  [HeroKind.NotificationsOnly]: NavStart.Surface,
  [HeroKind.PostsMarquee]: NavStart.Surface,
  [HeroKind.PostsCollage]: NavStart.Surface,
  [HeroKind.PostsSpotlight]: NavStart.Media,
};

/** How a version asks someone to join. */
export enum JoinFlow {
  /** The form opens over whatever page you are on. Version 4. */
  Modal = "modal",
  /** The form is a page of its own, linked from every join button. */
  Page = "page",
}

export const joinFlow: Record<RedesignVersion, JoinFlow> = {
  [RedesignVersion.V1]: JoinFlow.Page,
  [RedesignVersion.V2]: JoinFlow.Page,
  [RedesignVersion.V3]: JoinFlow.Page,
  [RedesignVersion.V4]: JoinFlow.Modal,
  [RedesignVersion.V5]: JoinFlow.Page,
  [RedesignVersion.V6]: JoinFlow.Page,
  [RedesignVersion.V7]: JoinFlow.Page,
};

export function parseVersion(raw: string | null): RedesignVersion {
  return redesignVersions.find((v) => String(v) === raw) ?? RedesignVersion.V1;
}

interface ThemeVars extends CSSProperties {
  "--rd-primary": string;
  "--rd-primary-hover": string;
  "--rd-accent": string;
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
    "--rd-accent": theme.accent,
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
