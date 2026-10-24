import { actionsQuery } from "@alliance/shared/lib/actionsListPage";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { unreadGeneralUpdatesQuery } from "@alliance/shared/lib/useGeneralUpdates";
import { globalFeedQuery } from "@alliance/shared/lib/useGlobalFeed";
import { waitFor } from "@testing-library/react";
import { expect, it } from "bun:test";
import { queryClient } from "../../lib/queryClient";
import { clientLoader } from "./HomePage";

serveApi(
  routes({
    "GET /actions/loggedIn": () => Response.json([]),
    "GET /actions/generalUpdates/unread": () => Response.json([]),
    "GET /actions/globalFeed": () => Response.json([]),
  }),
);

it("loads the page's queries without waiting for the page", async () => {
  expect(clientLoader()).toBeNull();
  await waitFor(() => {
    for (const { queryKey } of [
      actionsQuery,
      unreadGeneralUpdatesQuery,
      globalFeedQuery(10),
    ]) {
      expect(queryClient.getQueryState(queryKey)?.status).toBe("success");
    }
  });
});
