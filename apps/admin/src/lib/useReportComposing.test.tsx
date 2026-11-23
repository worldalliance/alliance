import { act, renderHook } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { MmsThreadsLiveContext, OFFLINE } from "./mmsThreadsLive";
import { useReportComposing } from "./useReportComposing";

const setup = (connected = true) => {
  const calls: string[] = [];
  const live = {
    ...OFFLINE,
    connected,
    reportComposing: (phoneNumber: string) =>
      calls.push(`report ${phoneNumber}`),
    stopComposing: (phoneNumber: string) => calls.push(`stop ${phoneNumber}`),
  };
  const wrapper = ({ children }: PropsWithChildren) => (
    <MmsThreadsLiveContext.Provider value={live}>
      {children}
    </MmsThreadsLiveContext.Provider>
  );
  const hook = renderHook(
    ({ phoneNumber, body }) => useReportComposing(phoneNumber, body),
    { wrapper, initialProps: { phoneNumber: "1", body: "" } },
  );
  const reconnect = () => {
    live.connected = true;
    hook.rerender({ phoneNumber: "1", body: "Hi" });
  };
  return { calls, hook, reconnect };
};

let now = 0;
beforeEach(() => {
  now = 0;
  jest.spyOn(Date, "now").mockImplementation(() => now);
});

it("reports nothing for an empty draft", () => {
  const { calls, hook } = setup();
  hook.rerender({ phoneNumber: "1", body: "   " });
  hook.unmount();
  expect(calls).toEqual([]);
});

it("reports on the first edit and refreshes at most every second", () => {
  const { calls, hook } = setup();
  hook.rerender({ phoneNumber: "1", body: "H" });
  now = 999;
  hook.rerender({ phoneNumber: "1", body: "Hi" });
  now = 1_000;
  hook.rerender({ phoneNumber: "1", body: "Hi!" });
  expect(calls).toEqual(["report 1", "report 1"]);
});

it("stops when the draft empties, and when the composer closes", () => {
  const { calls, hook } = setup();
  hook.rerender({ phoneNumber: "1", body: "Hi" });
  hook.rerender({ phoneNumber: "1", body: "" });
  hook.rerender({ phoneNumber: "1", body: "Hello" });
  act(() => hook.unmount());
  expect(calls).toEqual(["report 1", "stop 1", "report 1", "stop 1"]);
});

it("reports a draft written before the socket connected once it connects", () => {
  const { calls, hook, reconnect } = setup(false);
  hook.rerender({ phoneNumber: "1", body: "Hi" });
  expect(calls).toEqual([]);
  now = 1_000;
  reconnect();
  expect(calls).toEqual(["report 1"]);
});

it("doesn't report a draft left alone past the expiry when the socket reconnects", () => {
  const { calls, hook, reconnect } = setup(false);
  hook.rerender({ phoneNumber: "1", body: "Hi" });
  now = 10_000;
  reconnect();
  expect(calls).toEqual([]);
});
