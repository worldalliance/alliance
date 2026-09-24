import { run } from "@alliance/common/run";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { takeInterruptedAuthTab } from "./oauth";
import { AuthTabFlow, UNFINISHED } from "./oauthResult";

/** Opens settings when Android killed the app while a connect's Auth Tab was open. */
export function useInterruptedLinkRedirect() {
  const router = useRouter();
  useEffect(() => {
    run(async () => {
      if (await takeInterruptedAuthTab(AuthTabFlow.Link)) {
        router.navigate({
          pathname: "/settings",
          params: { oauthInterrupted: UNFINISHED },
        });
      }
    });
  }, [router]);
}
