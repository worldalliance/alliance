import AsyncStorage from "@react-native-async-storage/async-storage";
import { memoryAsyncStorage } from "./memoryAsyncStorage";
import { handledPushTaps, KEPT_PUSH_TAPS, pushTapRunner } from "./pushTaps";

beforeEach(memoryAsyncStorage);
afterEach(() => jest.restoreAllMocks());

describe("handledPushTaps", () => {
  it("passes each tap once, even when asked twice at once", async () => {
    const taps = handledPushTaps(jest.fn());
    expect(await Promise.all([taps.isNew("a"), taps.isNew("a")])).toEqual([
      true,
      false,
    ]);
    expect(await taps.isNew("b")).toBe(true);
  });

  it("skips a tap handled before a reload", async () => {
    await handledPushTaps(jest.fn()).markHandled("a");
    const afterReload = handledPushTaps(jest.fn());
    expect(await afterReload.isNew("a")).toBe(false);
    expect(await afterReload.isNew("b")).toBe(true);
  });

  it("passes a tap seen but not handled before a reload", async () => {
    await handledPushTaps(jest.fn()).isNew("a");
    expect(await handledPushTaps(jest.fn()).isNew("a")).toBe(true);
  });

  it(`keeps the last ${KEPT_PUSH_TAPS} handled taps`, async () => {
    const taps = handledPushTaps(jest.fn());
    for (let i = 0; i <= KEPT_PUSH_TAPS; i++) await taps.markHandled(`${i}`);
    const afterReload = handledPushTaps(jest.fn());
    expect(await afterReload.isNew("0")).toBe(true);
    expect(await afterReload.isNew("1")).toBe(false);
    expect(await afterReload.isNew(`${KEPT_PUSH_TAPS}`)).toBe(false);
  });

  it("reports a storage failure and still passes a new tap", async () => {
    jest.spyOn(AsyncStorage, "getItem").mockRejectedValue(new Error("disk"));
    const report = jest.fn();
    const taps = handledPushTaps(report);
    expect(await taps.isNew("a")).toBe(true);
    expect(await taps.isNew("a")).toBe(false);
    expect(report).toHaveBeenCalledTimes(1);
  });

  it.each([["not json"], [JSON.stringify({ a: 1 })]])(
    "reports stored taps it can't read: %p",
    async (stored) => {
      await AsyncStorage.setItem("handledPushTaps", stored);
      const report = jest.fn();
      expect(await handledPushTaps(report).isNew("a")).toBe(true);
      expect(report).toHaveBeenCalledTimes(1);
    },
  );
});

describe("pushTapRunner", () => {
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  const launch = (signedIn: { value: boolean }) =>
    pushTapRunner<{ tapId: string }>({
      taps: handledPushTaps(jest.fn()),
      canRun: () => signedIn.value,
    });

  it("runs a tap while signed in, and skips it when replayed after a reload", async () => {
    const run = jest.fn();
    expect(await launch({ value: true }).arrive({ tapId: "a" }, run)).toBe(
      true,
    );
    expect(run).toHaveBeenCalledWith({ tapId: "a" });
    await settle();

    const afterReload = jest.fn();
    expect(
      await launch({ value: true }).arrive({ tapId: "a" }, afterReload),
    ).toBe(false);
    expect(afterReload).not.toHaveBeenCalled();
  });

  it("holds a tap until sign-in, keeping it for after a reload until then", async () => {
    const signedIn = { value: false };
    const runner = launch(signedIn);
    const run = jest.fn();
    await runner.arrive({ tapId: "a" }, run);
    runner.resume(run);
    await settle();
    expect(run).not.toHaveBeenCalled();

    const afterReload = jest.fn();
    await launch({ value: true }).arrive({ tapId: "a" }, afterReload);
    expect(afterReload).toHaveBeenCalledWith({ tapId: "a" });

    signedIn.value = true;
    runner.resume(run);
    runner.resume(run);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("runs only the last tap that waited, and never the one it replaced", async () => {
    const signedIn = { value: false };
    const runner = launch(signedIn);
    const run = jest.fn();
    await runner.arrive({ tapId: "a" }, run);
    await runner.arrive({ tapId: "b" }, run);
    signedIn.value = true;
    runner.resume(run);
    expect(run.mock.calls).toEqual([[{ tapId: "b" }]]);

    await settle();
    expect(await launch({ value: true }).arrive({ tapId: "a" }, run)).toBe(
      false,
    );
  });
});
