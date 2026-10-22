import { client } from "@alliance/shared/client/client.gen";
import type { AnalyticsBackend } from "@alliance/shared/lib/analytics";
import { registerAnalytics } from "@alliance/shared/lib/analytics";
import { registerPosthogRequestContext } from "@alliance/shared/lib/posthog-request";
import {
  PostHogProviderProps,
  PostHogProvider as RNPostHogProvider,
  usePostHog,
} from "posthog-react-native";
import { type ReactNode, useEffect } from "react";
import { releaseTarget } from "./config";
import { linkOpeningSession } from "./linkOpenings";
import {
  posthogRequestContext,
  SESSION_IDLE_TIMEOUT_SECONDS,
} from "./posthogRequestContext";

const postHogProviderProps: Omit<PostHogProviderProps, "children"> = __DEV__
  ? {
      apiKey: "phc_4Bkir1Px9qIRnMQfMWQPcGIq6wjodf9jtme8fty3ZLt",
      options: {
        host: "https://us.i.posthog.com",
        defaultOptIn: false,
        sessionExpirationTimeSeconds: SESSION_IDLE_TIMEOUT_SECONDS,
      },
      autocapture: false,
    }
  : {
      apiKey: releaseTarget().posthog.apiKey,
      options: {
        host: releaseTarget().posthog.host,
        enableSessionReplay: true,
        captureAppLifecycleEvents: true,
        sessionExpirationTimeSeconds: SESSION_IDLE_TIMEOUT_SECONDS,
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
      void posthog.ready().then(() => linkOpeningSession.register(posthog));
      // AnalyticsBackend.flush is optional, so a posthog upgrade that dropped
      // flush would typecheck and turn every flushAnalytics into a silent
      // Unsupported. The pin makes that a build error instead.
      registerAnalytics(
        posthog satisfies Required<Pick<AnalyticsBackend, "flush">>,
      );
      return registerPosthogRequestContext({
        client,
        getContext: () => posthogRequestContext(posthog),
      });
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
