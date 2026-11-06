import { act, fireEvent, renderHook } from "@testing-library/react";
import { useDraftHistory } from "./useDraftHistory";

afterEach(() => {
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

it("drops a derived write made against the draft an undo replaced", () => {
  const { result } = renderHook(() => useDraftHistory(() => "start"));
  act(() => result.current.commit(() => "question"));

  act(() => {
    result.current.undo();
    result.current.withoutStep(() =>
      result.current.commit(() => "question+default"),
    );
  });
  expect(result.current.draft).toBe("start");
  expect(result.current.canUndo).toBe(false);

  act(() =>
    result.current.withoutStep(() => result.current.commit(() => "default")),
  );
  expect(result.current.draft).toBe("default");
  expect(result.current.canUndo).toBe(false);
});
