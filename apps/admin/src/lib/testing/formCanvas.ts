import { act, fireEvent, screen, within } from "@testing-library/react";

const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const canvas = () =>
  within(screen.getByRole("region", { name: "Form canvas" }));

export const canvasButton = (name: string) =>
  canvas().getByRole("button", { name });

export const canvasOrder = (name = /^Select /) =>
  canvas()
    .getAllByRole("button", { name })
    .map((button) => button.getAttribute("aria-label"));

/** Runs `item` from the More menu in the header of the pane the builder works in. */
export const fromMainMenu = (item: string) => {
  fireEvent.click(screen.getByRole("button", { name: "More" }));
  fireEvent.click(screen.getByRole("menuitem", { name: item }));
};

/** Whether the builder shows its Preview rather than Edit. */
export const previewing = () =>
  screen
    .getByRole("button", { name: "Preview" })
    .getAttribute("aria-pressed") === "true";

/** The selection's issues, opened from the settings header. */
export const issuesHere = () => {
  fireEvent.click(settings().getByRole("button", { name: /issues? here$/ }));
  return screen.getByRole("list", { name: "Issues here" });
};

const openSelectionMenu = () =>
  fireEvent.click(settings().getByRole("button", { name: /^More: / }));

/** Runs `item` from the selection's More menu in the settings header. */
export const fromSelectionMenu = (item: string) => {
  openSelectionMenu();
  fireEvent.click(screen.getByRole("menuitem", { name: item }));
};

/** The labels the selection's More menu offers now, a disabled one with its reason after it. */
export const selectionMenuItems = () => {
  openSelectionMenu();
  const items = screen
    .getAllByRole("menuitem")
    .map((item) => item.textContent ?? "");
  fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
  return items;
};

/** Whether the selection's More menu offers `item`, and whether it can be used now. */
export const selectionMenuState = (item: string) => {
  openSelectionMenu();
  const found = screen
    .getAllByRole("menuitem")
    .find((entry) => entry.textContent?.startsWith(item));
  const state = !found
    ? "absent"
    : found.getAttribute("aria-disabled") === "true"
      ? "disabled"
      : "enabled";
  fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
  return state;
};

/** What the toolbar says about saving: "Unsaved changes", "Saved", "" and the like. */
export const saveState = () => screen.getByLabelText("Save state").textContent;

export const formJson = () => {
  fromMainMenu("Edit form JSON…");
  const json = screen.getByRole<HTMLTextAreaElement>("textbox", {
    name: "Form JSON",
  }).value;
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  return json;
};

export const outline = () => within(screen.getByLabelText("Outline"));

/** Selects the canvas element whose label or text ends with `text`. */
export const selectElement = (text: string) =>
  fireEvent.click(
    canvas().getByRole("button", {
      name: new RegExp(`^Select .*${escapeRegExp(text)}$`),
    }),
  );

export const openSection = (name: "Content" | "Conditions" | "Advanced") =>
  fireEvent.click(screen.getByRole("tab", { name }));

/** The selected item's settings, in the sidebar or the drawer. */
export const settings = () =>
  within(screen.getByRole("complementary", { name: "Settings" }));

export const pageTitle = () =>
  screen.getByPlaceholderText<HTMLInputElement>("Page title");

export const heading = () => settings().getAllByRole("heading")[0]?.textContent;

export const canvasGroups = () =>
  screen.queryAllByRole("region", { name: "Visibility group" });

/** Selects a visibility group on the canvas, opening its shared rule. */
export const selectGroup = (group: HTMLElement) =>
  fireEvent.click(within(group).getByRole("button", { name: /^Shared/ }));

/** Opens the insert picker at `addButton`, then inserts the element named `name`. */
export const insertElement = (addButton: HTMLElement, name: string) => {
  fireEvent.click(addButton);
  fireEvent.change(screen.getByRole("textbox", { name: "Search elements" }), {
    target: { value: name },
  });
  fireEvent.click(
    screen.getByRole("button", {
      name: new RegExp(`^${escapeRegExp(name)}\\s*(Field|Block|Copy)$`),
    }),
  );
};

declare const happyDOM: { setViewport: (viewport: { width: number }) => void };

export const inNarrowWindow = () => {
  beforeEach(() => happyDOM.setViewport({ width: 800 }));
  afterEach(() => act(() => happyDOM.setViewport({ width: 1024 })));
};
