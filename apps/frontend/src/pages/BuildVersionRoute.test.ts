import { setEnv } from "@alliance/common/set-env";
import { afterEach, expect, it } from "bun:test";
import { buildVersionSchema } from "../lib/buildVersion";
import { loader } from "./BuildVersionRoute";

const savedSha = process.env.VITE_APP_GIT_SHA;
afterEach(() => setEnv("VITE_APP_GIT_SHA", savedSha));

it("serves the build's SHA uncached", async () => {
  process.env.VITE_APP_GIT_SHA = "deadbeef";
  const response = loader();
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(buildVersionSchema.parse(await response.json())).toEqual({
    sha: "deadbeef",
  });
});

it("serves a null SHA for a build without one", async () => {
  delete process.env.VITE_APP_GIT_SHA;
  expect(await loader().json()).toEqual({ sha: null });
});
