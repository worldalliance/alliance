/*
 * Only the *relative order* of these tiers matters — the concrete `z-*` values
 * are arbitrary. Feel free to renumber them (or insert a new tier between two
 * existing ones) as long as the ordering invariants above are preserved; every
 * consumer references the named tiers, not the raw numbers.
 */

/**
 * Web z-index scale — the single source of truth for stacking order across
 * `sharedweb`, `apps/frontend`, and `apps/admin`.
 *
 * Popovers/tooltips/dropdowns are routinely opened from inside a modal and
 * portal to `<body>`; at the modal's tier or below they'd render behind it (or
 * get clipped by its `overflow`). `toast` sits above everything.
 *
 * Numeric values behind the `zIndex` classes, for the rare consumer that needs
 * a raw number (e.g. a library that takes a z-index prop) instead of a
 * Tailwind class.
 */
export const zIndexValues = {
  /** Normal in-flow content. */
  base: 0,
  /** Overlapping siblings, raised/sticky-in-flow cards. */
  raised: 10,
  /** Sticky headers, top nav, fixed app chrome. */
  nav: 20,
  /** Side drawers / slide-overs. */
  drawer: 30,
  /** Dialogs, modals, lightboxes, and their backdrops. */
  modal: 40,
  /** Below popovers. */
  popoverBackdrop: 50,
  /** Dropdowns, selects, hover cards, tooltips, context menus. */
  popover: 60,
  /** Toasts / notifications — always on top. */
  toast: 70,
} as const satisfies Record<string, number>;

export const zIndex = {
  base: "z-0",
  raised: "z-10",
  nav: "z-20",
  drawer: "z-30",
  modal: "z-40",
  popoverBackdrop: "z-50",
  popover: "z-60",
  toast: "z-70",
} as const satisfies {
  [K in keyof typeof zIndexValues]: `z-${(typeof zIndexValues)[K]}`;
};

export type ZIndexTier = keyof typeof zIndex;
