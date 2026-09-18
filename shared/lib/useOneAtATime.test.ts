import { act, cleanup, renderHook } from "@testing-library/react";
import { useOneAtATime } from "./useOneAtATime";

afterEach(cleanup);

const pending = () => {
  let finish = () => {};
  const done = new Promise<void>((resolve) => {
    finish = resolve;
  });
  return { done, finish };
};

it("drops a task handed over while another is running", async () => {
  const { result } = renderHook(() => useOneAtATime());
  const first = pending();
  let started = 0;

  let running = Promise.resolve();
  act(() => {
    running = result.current.run(() => {
      started++;
      return first.done;
    });
    void result.current.run(async () => {
      started++;
    });
  });
  first.finish();
  await act(() => running);

  expect(started).toBe(1);
});

it("is busy only while a task runs", async () => {
  const { result } = renderHook(() => useOneAtATime());
  const task = pending();

  let running = Promise.resolve();
  act(() => {
    running = result.current.run(() => task.done);
  });
  expect(result.current.busy).toBe(true);

  task.finish();
  await act(() => running);
  expect(result.current.busy).toBe(false);
});

it("takes the next task after one that threw", async () => {
  const { result } = renderHook(() => useOneAtATime());
  let started = 0;

  await act(() =>
    result.current
      .run(() => Promise.reject(new Error("refused")))
      .catch(() => {}),
  );
  await act(() =>
    result.current.run(async () => {
      started++;
    }),
  );

  expect(started).toBe(1);
});
