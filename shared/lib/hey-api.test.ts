import { errorMessage } from "@alliance/common/errorMessage";
import { client } from "../client/client.gen";
import { createClientConfig } from "./hey-api";
import { routes, serveApi, type RouteTable } from "./testing/serveApi";

const originalNavigator = globalThis.navigator;

const runningAs = (product: string): void => {
  Object.defineProperty(globalThis, "navigator", {
    value: { product },
    configurable: true,
  });
};

afterEach(() => {
  Object.defineProperty(globalThis, "navigator", {
    value: originalNavigator,
    configurable: true,
  });
});

describe("createClientConfig", () => {
  it("omits cookies in the app", () => {
    runningAs("ReactNative");

    expect(createClientConfig().credentials).toBe("omit");
  });

  it("sends them in a browser", () => {
    runningAs("Gecko");

    expect(createClientConfig().credentials).toBe("include");
  });
});

const refusals = {
  "GET /shaped": () =>
    Response.json(
      { statusCode: 403, message: "Not yours", error: "Forbidden" },
      { status: 500 },
    ),
  // What NestJS answers for an exception built from an object literal.
  "GET /unshaped": () =>
    Response.json(
      { message: "Invalid form schema", errors: [] },
      { status: 400 },
    ),
  "GET /empty": () => new Response(null, { status: 401 }),
  "GET /text": () => new Response("Unauthorized", { status: 401 }),
  "GET /html": () =>
    new Response("<html><body>413 Request Entity Too Large</body></html>", {
      status: 413,
      headers: { "Content-Type": "text/html" },
    }),
} satisfies RouteTable;

const api = serveApi(routes(refusals));

beforeEach(() => api.throwingOnRefusal(refusals));

const thrownBy = (url: string) => expect(client.get({ url })).rejects;

it("uses the response status and preserves the other error fields", async () => {
  await thrownBy("/shaped").toEqual({
    statusCode: 500,
    message: "Not yours",
    error: "Forbidden",
  });
});

it("gives a refusal carrying no statusCode the response status", async () => {
  await thrownBy("/unshaped").toEqual({
    statusCode: 400,
    message: "Invalid form schema",
    errors: [],
  });
});

it("gives a refusal with no body at all the response status", async () => {
  await thrownBy("/empty").toEqual({ statusCode: 401, body: "" });
});

it("preserves a plain text refusal with the response status", async () => {
  await thrownBy("/text").toEqual({ statusCode: 401, body: "Unauthorized" });
});

it("keeps the caller's fallback when a proxy returns HTML", async () => {
  const error = await client
    .get({ url: "/html" })
    .catch((thrown: unknown) => thrown);

  expect(error).toEqual({
    statusCode: 413,
    body: "<html><body>413 Request Entity Too Large</body></html>",
  });
  expect(
    errorMessage({ error, fallback: "Could not upload. Try again." }),
  ).toBe("Could not upload. Try again.");
});
