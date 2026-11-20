import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, mock } from "bun:test";
import Disclosure from "./Disclosure";

it("reports through onToggle whether it is open", async () => {
  const onToggle = mock();
  render(
    <Disclosure summary="More" onToggle={onToggle}>
      Body
    </Disclosure>,
  );

  fireEvent.click(screen.getByText("More"));
  await waitFor(() => expect(onToggle).toHaveBeenLastCalledWith(true));
  fireEvent.click(screen.getByText("More"));
  await waitFor(() => expect(onToggle).toHaveBeenLastCalledWith(false));
  expect(onToggle).toHaveBeenCalledTimes(2);
});
