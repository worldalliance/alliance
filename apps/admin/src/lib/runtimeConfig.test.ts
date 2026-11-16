import { NodeEnv } from "@alliance/common/node-env";
import { deployedWebRuntimeConfig } from "@alliance/sharedweb/lib/testing/runtimeConfig";
import { describe, expect, it, jest } from "bun:test";
import { fetchWebRuntimeConfig } from "./runtimeConfig";

const staging = deployedWebRuntimeConfig(NodeEnv.Staging);

const respond = (response: Response | Error) =>
  response instanceof Error
    ? jest.spyOn(globalThis, "fetch").mockRejectedValue(response)
    : jest.spyOn(globalThis, "fetch").mockResolvedValue(response);

describe("fetchWebRuntimeConfig", () => {
  it("returns a valid config, fetched uncached", async () => {
    const fetchSpy = respond(Response.json(staging));
    expect(await fetchWebRuntimeConfig()).toEqual({
      ok: true,
      value: staging,
    });
    const [path, init] = fetchSpy.mock.calls[0];
    expect(path).toBe("/config.json");
    expect(init?.cache).toBe("no-cache");
  });

  it("gives up when the timeout fires", async () => {
    const deadline = new AbortController();
    const timeout = jest
      .spyOn(AbortSignal, "timeout")
      .mockReturnValue(deadline.signal);
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockReturnValue(
        new Promise((_resolve, reject) =>
          deadline.signal.addEventListener("abort", () =>
            reject(deadline.signal.reason),
          ),
        ),
      );
    const result = fetchWebRuntimeConfig();
    deadline.abort(new Error("timed out"));
    expect(await result).toEqual({
      ok: false,
      error: "/config.json didn't load: timed out",
    });
    expect(timeout).toHaveBeenCalledWith(10_000);
    expect(fetchSpy.mock.calls[0][1]?.signal).toBe(deadline.signal);
  });

  it.each([
    [new Error("network down"), "/config.json didn't load: network down"],
    [new Response("missing", { status: 404 }), "/config.json answered 404"],
    [new Response("<html>"), "/config.json isn't JSON: "],
  ])("names a failed load (%#)", async (response, message) => {
    respond(response);
    const result = await fetchWebRuntimeConfig();
    expect(result.ok ? null : result.error).toStartWith(message);
  });

  it("refuses a config missing a deployed value", async () => {
    respond(Response.json({ ...staging, VITE_PUBLIC_POSTHOG_KEY: undefined }));
    const result = await fetchWebRuntimeConfig();
    expect(result.ok ? null : result.error).toStartWith(
      "/config.json is invalid:",
    );
    expect(result.ok ? null : result.error).toContain(
      "VITE_PUBLIC_POSTHOG_KEY",
    );
  });
});
