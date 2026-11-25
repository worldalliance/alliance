import { client } from "@alliance/shared/client/client.gen";
import { registerAnalytics } from "@alliance/shared/lib/analytics";
import { registerPosthogRequestContext } from "@alliance/shared/lib/posthog-request";
import * as Updates from "expo-updates";
import {
  PostHogProviderProps,
  PostHogProvider as RNPostHogProvider,
  usePostHog,
} from "posthog-react-native";
import { type ReactNode, useEffect } from "react";
import { releaseTarget } from "./config";
import { linkOpeningSession } from "./linkOpenings";
import { otaUpdateProperties } from "./otaUpdateProperties";
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
        // Set at init rather than with register() so the lifecycle events
        // captured during init carry them too. PostHog types these properties
        // as a closed set but sends every key on every event.
        customAppProperties: (properties) => ({
          ...properties,
          ...otaUpdateProperties(Updates),
        }),
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
      registerAnalytics(posthog);
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
