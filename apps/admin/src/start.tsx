import { R } from "@alliance/common/result";
import { client } from "@alliance/shared/client/client.gen";
import { setWebRuntimeConfig } from "@alliance/sharedweb/lib/runtimeConfig";
import ReactDOM from "react-dom/client";
import { ConfigErrorScreen } from "./ConfigErrorScreen";
import { initAnalytics } from "./lib/analytics";
import { getApiUrl } from "./lib/config";
import { fetchWebRuntimeConfig } from "./lib/runtimeConfig";

export async function start(hydrate: () => void): Promise<void> {
  // The schema accepts development and test configs without URLs, which a
  // built panel can't use, so getApiUrl's check counts as loading too.
  const loaded = R.flatMap(await fetchWebRuntimeConfig(), (config) =>
    R.fromThrowable(
      () => {
        setWebRuntimeConfig(config);
        client.setConfig({ baseUrl: getApiUrl() });
      },
      (error) => R.toError(error).message,
    ),
  );
  if (!loaded.ok) {
    console.error(loaded.error);
    const container = document.createElement("div");
    document.body.replaceChildren(container);
    ReactDOM.createRoot(container).render(
      <ConfigErrorScreen detail={loaded.error} />,
    );
    return;
  }
  initAnalytics();
  hydrate();
}
