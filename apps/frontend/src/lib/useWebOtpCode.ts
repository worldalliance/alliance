import { useEffect, useEffectEvent } from "react";

declare global {
  interface CredentialRequestOptions {
    otp?: { transport: "sms"[] };
  }
}

/** Chrome on Android offers a texted code only to a page that asks this way; Safari reads `autocomplete="one-time-code"` instead. It asks again after each code, so a resent text is offered too. */
export function useWebOtpCode(params: {
  enabled: boolean;
  onCode: (code: string) => void;
}): void {
  const { enabled } = params;
  const deliver = useEffectEvent(params.onCode);
  useEffect(() => {
    if (!enabled || !("OTPCredential" in window)) return;
    const abort = new AbortController();
    const listen = (): void => {
      navigator.credentials
        .get({ otp: { transport: ["sms"] }, signal: abort.signal })
        .then(
          (credential) => {
            if (!credential || !("code" in credential)) return;
            deliver(String(credential.code));
            listen();
          },
          (error) => {
            if (!abort.signal.aborted)
              console.warn("WebOTP request failed", error);
          },
        );
    };
    listen();
    return () => abort.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliver is an Effect Event, which this plugin version does not recognize.
  }, [enabled]);
}
