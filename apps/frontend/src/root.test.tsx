import { NodeEnv } from "@alliance/common/node-env";
import { setEnv } from "@alliance/common/set-env";
import { client } from "@alliance/shared/client/client.gen";
import {
  clearWebRuntimeConfig,
  webEnvironment,
} from "@alliance/sharedweb/lib/runtimeConfig";
import { render, screen } from "@testing-library/react";
import { afterAll, describe, expect, it, jest } from "bun:test";
import { createRoutesStub } from "react-router";

// root.tsx registers a request interceptor on load, which delays the API
// client's requests by a tick in every file that runs after this one.
const use = jest.spyOn(client.interceptors.request, "use");
const { Layout, meta } = await import("./root");
const registered = use.mock.calls.map(([interceptor]) => interceptor);
use.mockRestore();
afterAll(() => {
  for (const interceptor of registered)
    client.interceptors.request.eject(interceptor);
});

function Environment() {
  return <p>{webEnvironment()}</p>;
}

describe("Layout", () => {
  it("hands the root loader's config to the page before it renders", async () => {
    const Stub = createRoutesStub([
      {
        id: "root",
        path: "/",
        loader: () => ({ environment: NodeEnv.Staging }),
        HydrateFallback: () => null,
        Component: () => (
          <Layout>
            <Environment />
          </Layout>
        ),
      },
    ]);
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 401 }));
    render(<Stub />);
    expect(await screen.findByText(NodeEnv.Staging)).toBeDefined();
  });

  it("renders a production page without config when the root loader didn't run", async () => {
    const prod = process.env.PROD;
    process.env.PROD = "true";
    clearWebRuntimeConfig();
    const Stub = createRoutesStub([
      {
        id: "root",
        path: "/",
        HydrateFallback: () => null,
        Component: () => (
          <Layout>
            <p>Page</p>
          </Layout>
        ),
      },
    ]);
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 401 }));
    try {
      render(<Stub />);
      expect(await screen.findByText("Page")).toBeDefined();
    } finally {
      setEnv("PROD", prod);
    }
  });
});

describe("meta", () => {
  it("reads no config when the root loader didn't run", () => {
    expect(meta({})).toEqual([{ title: "Alliance" }]);
  });
});
