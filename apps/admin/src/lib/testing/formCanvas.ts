import { fireEvent, screen, within } from "@testing-library/react";

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
