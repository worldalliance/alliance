/** The selection's select button, marked pressed, within `root`; a range's focus first. */
export const selectedOnCanvas = (root: HTMLElement | null) =>
  root?.querySelector<HTMLElement>("[data-selection-focus]") ??
  root?.querySelector<HTMLElement>('[aria-pressed="true"]');
