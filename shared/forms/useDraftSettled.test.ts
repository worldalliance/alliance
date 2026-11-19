import { renderHook } from "@testing-library/react";
import { useDraftSettled } from "./useDraftSettled";

type Props = Parameters<typeof useDraftSettled>[0];

const render = (initialProps: Props) => {
  const renders: boolean[] = [];
  const hook = renderHook(
    (props: Props) => {
      const settled = useDraftSettled(props);
      renders.push(settled);
      return settled;
    },
    { initialProps },
  );
  return { ...hook, renders };
};

const fetched: Props = {
  localDraftRead: true,
  fetchEnabled: true,
  fetchSettled: true,
};

it("settles in the render that reads the local draft while not fetching", () => {
  const hook = render({
    ...fetched,
    localDraftRead: false,
    fetchEnabled: false,
  });
  expect(hook.result.current).toBe(false);

  const read = hook.renders.length;
  hook.rerender({ ...fetched, fetchEnabled: false });

  expect(hook.renders[read]).toBe(true);
});

it.each([
  ["the local read", { ...fetched, localDraftRead: false }],
  ["the fetch", { ...fetched, fetchSettled: false }],
])(
  "settles from an effect once both have landed, with %s last",
  (_, before) => {
    const hook = render(before);
    expect(hook.result.current).toBe(false);

    const landed = hook.renders.length;
    hook.rerender(fetched);

    expect(hook.renders[landed]).toBe(false);
    expect(hook.result.current).toBe(true);
  },
);

it("unsettles in the same render that fetching turns on", () => {
  const hook = render({ ...fetched, fetchEnabled: false });
  expect(hook.result.current).toBe(true);

  const before = hook.renders.length;
  hook.rerender({ ...fetched, fetchSettled: false });

  expect(hook.renders[before]).toBe(false);
  expect(hook.result.current).toBe(false);
  hook.rerender(fetched);
  expect(hook.result.current).toBe(true);
});

it("stays settled while a fetched draft refetches", () => {
  const hook = render(fetched);
  expect(hook.result.current).toBe(true);

  hook.rerender({ ...fetched, fetchSettled: false });

  expect(hook.result.current).toBe(true);
});

it("waits for the next fetch when fetching turns off and on again", () => {
  const hook = render(fetched);
  hook.rerender({ ...fetched, fetchEnabled: false });
  expect(hook.result.current).toBe(true);

  hook.rerender({ ...fetched, fetchSettled: false });

  expect(hook.result.current).toBe(false);
});
