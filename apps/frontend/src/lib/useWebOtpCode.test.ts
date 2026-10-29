import { renderHook, waitFor } from "@testing-library/react";
import { expect, mock, onTestFinished, spyOn, test } from "bun:test";
import { useWebOtpCode } from "./useWebOtpCode";

const offerCode = (get: (options: CredentialRequestOptions) => unknown) => {
  const spy = mock(get);
  Object.defineProperty(window, "OTPCredential", {
    value: class {},
    configurable: true,
  });
  Object.defineProperty(navigator, "credentials", {
    value: { get: spy },
    configurable: true,
  });
  onTestFinished(() => {
    Reflect.deleteProperty(window, "OTPCredential");
    Reflect.deleteProperty(navigator, "credentials");
  });
  return spy;
};

const texts =
  (...codes: string[]) =>
  (): Promise<{ code: string }> =>
    codes.length
      ? Promise.resolve({ code: codes.shift() ?? "" })
      : new Promise(() => {});

test("hands over the code the browser reads from a text", async () => {
  offerCode(texts("654321"));
  const onCode = mock();
  renderHook(() => useWebOtpCode({ enabled: true, onCode }));
  await waitFor(() => expect(onCode).toHaveBeenCalledWith("654321"));
});

test("asks nothing while disabled", () => {
  const get = offerCode(() => Promise.resolve(null));
  renderHook(() => useWebOtpCode({ enabled: false, onCode: () => {} }));
  expect(get).not.toHaveBeenCalled();
});

test("withdraws the request on unmount", () => {
  const get = offerCode(() => new Promise(() => {}));
  const { unmount } = renderHook(() =>
    useWebOtpCode({ enabled: true, onCode: () => {} }),
  );
  unmount();
  expect(get.mock.calls[0]?.[0].signal?.aborted).toBe(true);
});

test("keeps one request across renders with a new callback", () => {
  const get = offerCode(() => new Promise(() => {}));
  const { rerender } = renderHook(() =>
    useWebOtpCode({ enabled: true, onCode: () => {} }),
  );
  rerender();
  expect(get).toHaveBeenCalledTimes(1);
});

test("asks again after a code, so a resent text is offered too", async () => {
  offerCode(texts("111111", "222222"));
  const onCode = mock();
  renderHook(() => useWebOtpCode({ enabled: true, onCode }));
  await waitFor(() => expect(onCode).toHaveBeenCalledTimes(2));
  expect(onCode.mock.calls).toEqual([["111111"], ["222222"]]);
});

test("leaves a browser without WebOTP alone", () => {
  const get = offerCode(() => Promise.resolve(null));
  Reflect.deleteProperty(window, "OTPCredential");
  renderHook(() => useWebOtpCode({ enabled: true, onCode: () => {} }));
  expect(get).not.toHaveBeenCalled();
});

test("absorbs the rejection of a withdrawn request", async () => {
  const warn = spyOn(console, "warn").mockImplementation(() => {});
  onTestFinished(() => warn.mockRestore());
  const rejected = Promise.withResolvers<void>();
  offerCode(
    ({ signal }) =>
      new Promise((_, reject) =>
        signal?.addEventListener("abort", () => {
          reject(new DOMException("", "AbortError"));
          rejected.resolve();
        }),
      ),
  );
  const onCode = mock();
  const { unmount } = renderHook(() =>
    useWebOtpCode({ enabled: true, onCode }),
  );
  unmount();
  await rejected.promise;
  expect(onCode).not.toHaveBeenCalled();
  expect(warn).not.toHaveBeenCalled();
});

test("warns when the browser refuses the request", async () => {
  const warn = spyOn(console, "warn").mockImplementation(() => {});
  onTestFinished(() => warn.mockRestore());
  const refusal = new DOMException("", "NotAllowedError");
  offerCode(() => Promise.reject(refusal));
  renderHook(() => useWebOtpCode({ enabled: true, onCode: () => {} }));
  await waitFor(() =>
    expect(warn).toHaveBeenCalledWith(expect.any(String), refusal),
  );
});
