import type { AnalyticsBackend } from "@alliance/shared/lib/analytics";
import { registerAnalytics } from "@alliance/shared/lib/analytics";
import {
  PostHogProviderProps,
  PostHogProvider as RNPostHogProvider,
  usePostHog,
} from "posthog-react-native";
import { type ReactNode, useEffect } from "react";

const postHogProviderProps: Omit<PostHogProviderProps, "children"> = __DEV__
  ? {
      apiKey: "phc_4Bkir1Px9qIRnMQfMWQPcGIq6wjodf9jtme8fty3ZLt",
      options: {
        host: "https://us.i.posthog.com",
        defaultOptIn: false,
      },
      autocapture: false,
    }
  : {
      apiKey: "phc_4Bkir1Px9qIRnMQfMWQPcGIq6wjodf9jtme8fty3ZLt",
      options: {
        host:
          process.env.EXPO_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
        enableSessionReplay: true,
        captureAppLifecycleEvents: true,
        sessionReplayConfig: {
          maskAllTextInputs: false,
          captureLog: true,
          captureNetworkTelemetry: true,
          throttleDelayMs: 250,
        },
      },
    };

function AnalyticsBridge() {
  const posthog = usePostHog();
  useEffect(() => {
    if (posthog) {
      // AnalyticsBackend.flush is optional, so a posthog upgrade that dropped
      // flush would typecheck and turn every flushAnalytics into a silent
      // Unsupported. The pin makes that a build error instead.
      registerAnalytics(
        posthog satisfies Required<Pick<AnalyticsBackend, "flush">>,
      );
    }
  }, [posthog]);
  return null;
}

export default function PostHogProvider({ children }: { children: ReactNode }) {
  return (
    <RNPostHogProvider {...postHogProviderProps}>
      <AnalyticsBridge />
      {children}
    </RNPostHogProvider>
  );
}
