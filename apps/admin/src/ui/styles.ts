/** The box of a text control: input, textarea, select. Height is the caller's. */
export const controlClass =
  "w-full rounded-md border border-line-control bg-surface px-2.5 text-body text-fg placeholder:text-fg-muted transition-colors duration-fast focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-accent disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-fg-muted aria-invalid:border-danger";

/** The surface of anything that floats over the page: menu, popover, tooltip. */
export const popupClass =
  "rounded-md bg-surface text-body text-fg shadow-pop outline-none";

/** A table's first-column link to the row's record: reads as its name, underlined on hover. */
export const nameLinkClass =
  "rounded-sm font-medium text-fg focus-ring hover:underline";

/** A link among other text or values: underlined at rest, so colour isn't its only cue. */
export const linkClass = "rounded-sm text-accent underline focus-ring";
