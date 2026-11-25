import { fireEvent, screen } from "@testing-library/react";

/** Opens a row's "More" menu and picks one of its items. */
export async function chooseRowAction(rowName: string, item: string) {
  fireEvent.click(
    await screen.findByRole("button", { name: `More: ${rowName}` }),
  );
  fireEvent.click(await screen.findByRole("menuitem", { name: item }));
}
