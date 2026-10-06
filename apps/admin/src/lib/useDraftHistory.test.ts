import { act, cleanup, fireEvent, renderHook } from "@testing-library/react";
import { useDraftHistory } from "./useDraftHistory";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

it("keeps a write that lands outside an edit event out of the typing step", async () => {
  const input = document.createElement("input");
  document.body.append(input);
  const { result } = renderHook(() => useDraftHistory(() => ""));
  act(() => input.focus());

  input.addEventListener("input", () => result.current.commit(() => "typed"));
  act(() => {
    fireEvent.input(input);
  });
  await act(async () => {
    await Promise.resolve();
    result.current.commit((draft) => `${draft}+image`);
  });

  act(() => result.current.undo());
  expect(result.current.draft).toBe("typed");
});
