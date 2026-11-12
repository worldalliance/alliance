import { webEnv } from "@alliance/sharedweb/lib/env";
import { type z } from "zod";
import { type buildVersionSchema } from "../lib/buildVersion";

/** The commit the server's build came from, for tabs to compare with theirs. */
export function loader() {
  return Response.json(
    {
      sha: webEnv("VITE_APP_GIT_SHA") ?? null,
    } satisfies z.infer<typeof buildVersionSchema>,
    { headers: { "Cache-Control": "no-store" } },
  );
}
