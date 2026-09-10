import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { useHeldOn } from "./useHeldOn";

afterEach(cleanup);

it("starts where the flag starts", () => {
  const { result } = renderHook(() => useHeldOn(true, 50));
  expect(result.current).toBe(true);
});

it("holds on after a flag that drops at once", async () => {
  const { result, rerender } = renderHook(
    ({ active }: { active: boolean }) => useHeldOn(active, 50),
    { initialProps: { active: false } },
  );

  rerender({ active: true });
  rerender({ active: false });

  expect(result.current).toBe(true);
  await waitFor(() => expect(result.current).toBe(false));
});

it("drops with a flag that was up long enough to be seen", async () => {
  const { result, rerender } = renderHook(
    ({ active }: { active: boolean }) => useHeldOn(active, 20),
    { initialProps: { active: true } },
  );

  await act(() => new Promise((resolve) => setTimeout(resolve, 40)));
  rerender({ active: false });

  expect(result.current).toBe(false);
});

it("holds on from the newest raise rather than the first", async () => {
  const { result, rerender } = renderHook(
    ({ active }: { active: boolean }) => useHeldOn(active, 60),
    { initialProps: { active: true } },
  );

  rerender({ active: false });
  rerender({ active: true });
  await act(() => new Promise((resolve) => setTimeout(resolve, 40)));
  rerender({ active: false });

  expect(result.current).toBe(true);
  await waitFor(() => expect(result.current).toBe(false));
});

it("arms nothing for a flag that was never raised", () => {
  const timer = jest.spyOn(globalThis, "setTimeout");

  renderHook(() => useHeldOn(false, 50));

  expect(timer).not.toHaveBeenCalled();
});
