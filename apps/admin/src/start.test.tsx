import { NodeEnv } from "@alliance/common/node-env";
import { client } from "@alliance/shared/client/client.gen";
import { webEnvironment } from "@alliance/sharedweb/lib/runtimeConfig";
import { deployedWebRuntimeConfig } from "@alliance/sharedweb/lib/testing/runtimeConfig";
import { screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, jest } from "bun:test";
import { start } from "./start";

const staging = deployedWebRuntimeConfig(NodeEnv.Staging);

describe("start", () => {
  let baseUrl: string | undefined;
  beforeEach(() => {
    baseUrl = client.getConfig().baseUrl;
    jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    client.setConfig({ baseUrl });
    document.body.replaceChildren();
  });

  it("loads the config and the API base URL before hydrating", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(staging));
    let seen: { environment: NodeEnv; baseUrl?: string } | undefined;
    await start(() => {
      seen = {
        environment: webEnvironment(),
        baseUrl: client.getConfig().baseUrl,
      };
    });
    expect(seen).toEqual({
      environment: NodeEnv.Staging,
      baseUrl: "https://app.example.com/api",
    });
  });

  it("shows the error screen instead of hydrating when the config fails", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("missing", { status: 404 }));
    const hydrate = jest.fn();
    await start(hydrate);
    expect(
      await screen.findByText("The admin panel couldn't load its settings"),
    ).toBeDefined();
    expect(screen.getByText("/config.json answered 404")).toBeDefined();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("heading", {
          name: "The admin panel couldn't load its settings",
        }),
      ),
    );
    expect(hydrate).not.toHaveBeenCalled();
  });

  it("shows the error screen when a valid config has no API URL", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json({ environment: NodeEnv.Test }));
    const hydrate = jest.fn();
    await start(hydrate);
    expect(
      await screen.findByText("The admin panel couldn't load its settings"),
    ).toBeDefined();
    expect(screen.getByText(/VITE_API_URL: missing/)).toBeDefined();
    expect(hydrate).not.toHaveBeenCalled();
  });
});
