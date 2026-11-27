import { fireEvent, screen } from "@testing-library/react";

/** Types `query` into a `UserSelect`'s search and clicks the option named `name`. */
export async function pickUser(
  search: HTMLElement,
  { query, name }: { query: string; name: string | RegExp },
) {
  fireEvent.keyDown(search, { key: "ArrowDown" });
  fireEvent.change(search, { target: { value: query } });
  fireEvent.click(await screen.findByRole("option", { name }));
}
