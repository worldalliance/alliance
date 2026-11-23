import { errorMessage, GENERIC_FAILURE } from "@alliance/common/errorMessage";
import { R } from "@alliance/common/result";
import { client } from "../client/client.gen";
import { createClientConfig, refreshSession } from "./hey-api";
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

describe("a request refused for an expired session", () => {
  let sent: string[] = [];
  let refreshes = 0;
  const expiredOnce = async (request: Request) => {
    sent.push(await request.text());
    return new Response(null, { status: sent.length === 1 ? 401 : 200 });
  };

  beforeEach(() => {
    sent = [];
    refreshes = 0;
    api.alsoServing({
      "POST /auth/refresh": () => {
        refreshes++;
        return Response.json({});
      },
    });
  });

  it("is sent again after the refresh", async () => {
    const { fetch } = createClientConfig({ fetch: expiredOnce });

    const res = await fetch!(
      new Request("http://api.test/goal", { method: "POST", body: "{}" }),
    );

    expect(res.status).toBe(200);
    expect(sent).toEqual(["{}", "{}"]);
  });

  it("shares one refresh with the requests refused alongside it", async () => {
    const refused = new Set<string>();
    const { fetch } = createClientConfig({
      fetch: async (request: Request) => {
        const firstTry = !refused.has(request.url);
        refused.add(request.url);
        return new Response(null, { status: firstTry ? 401 : 200 });
      },
    });

    const statuses = await Promise.all(
      ["tasks", "updates", "feed"].map((path) =>
        fetch!(new Request(`http://api.test/${path}`)).then(
          (res) => res.status,
        ),
      ),
    );

    expect(statuses).toEqual([200, 200, 200]);
    expect(refreshes).toBe(1);
  });

  it("refreshes again for a request refused after the last refresh settled", async () => {
    const { fetch } = createClientConfig({ fetch: expiredOnce });
    await fetch!(
      new Request("http://api.test/goal", { method: "POST", body: "{}" }),
    );
    sent = [];

    await fetch!(
      new Request("http://api.test/goal", { method: "POST", body: "{}" }),
    );

    expect(refreshes).toBe(2);
  });

  it("reports one signed-out session for the requests refused together", async () => {
    api.alsoServing({
      "POST /auth/refresh": () => {
        refreshes++;
        return new Response(null, { status: 401 });
      },
    });
    let signedOut = 0;
    const onSignedOut = () => signedOut++;
    window.addEventListener("auth:unauthorized", onSignedOut);
    const { fetch } = createClientConfig({
      fetch: async () => new Response(null, { status: 401 }),
    });

    const statuses = await Promise.all(
      ["tasks", "updates", "feed"].map((path) =>
        fetch!(new Request(`http://api.test/${path}`)).then(
          (res) => res.status,
        ),
      ),
    );
    window.removeEventListener("auth:unauthorized", onSignedOut);

    expect(statuses).toEqual([401, 401, 401]);
    expect(refreshes).toBe(1);
    expect(signedOut).toBe(1);
  });

  it("reports the signed-out session when it is refused again after the refresh", async () => {
    let signedOut = 0;
    const onSignedOut = () => signedOut++;
    window.addEventListener("auth:unauthorized", onSignedOut);
    const { fetch } = createClientConfig({
      fetch: async () => new Response(null, { status: 401 }),
    });

    const res = await fetch!(new Request("http://api.test/tasks"));
    window.removeEventListener("auth:unauthorized", onSignedOut);

    expect(res.status).toBe(401);
    expect(refreshes).toBe(1);
    expect(signedOut).toBe(1);
  });

  // The refresh route refuses only with 401, so a 403 comes from something in
  // between, such as a proxy, and says nothing about the session.
  it.each([503, 403])(
    "fails, rather than reporting the session expired, when the refresh answers %i",
    async (status) => {
      api.alsoServing({
        "POST /auth/refresh": () => new Response(null, { status }),
      });
      let signedOut = 0;
      const onSignedOut = () => signedOut++;
      window.addEventListener("auth:unauthorized", onSignedOut);
      const { fetch } = createClientConfig({ fetch: expiredOnce });

      await expect(
        fetch!(new Request("http://api.test/tasks")),
      ).rejects.toThrow(GENERIC_FAILURE);
      window.removeEventListener("auth:unauthorized", onSignedOut);
      expect(signedOut).toBe(0);
    },
  );

  it("is not sent again when it carries a multipart body", async () => {
    const { fetch } = createClientConfig({ fetch: expiredOnce });
    const body = new FormData();
    body.append("files", new File(["#EXTM3U"], "playlist.m3u8"));

    const res = await fetch!(
      new Request("http://api.test/videos/upload", { method: "POST", body }),
    );

    expect(res.status).toBe(401);
    expect(sent).toHaveLength(1);
    expect(refreshes).toBe(1);
  });
});

describe("refreshSession", () => {
  const answering = (status: number) =>
    api.alsoServing({
      "POST /auth/refresh": () => new Response(null, { status }),
    });

  it("reports a refreshed session", async () => {
    answering(200);

    expect(await refreshSession()).toEqual(R.success(true));
  });

  it("reports a refused session", async () => {
    answering(401);

    expect(await refreshSession()).toEqual(R.success(false));
  });

  it("fails when the refresh couldn't settle the session", async () => {
    answering(503);

    expect(await refreshSession()).toEqual(
      R.failure(new Error(GENERIC_FAILURE, { cause: 503 })),
    );
  });

  it("fails when the refresh couldn't be sent, then sends the next one", async () => {
    api.alsoServing({
      "POST /auth/refresh": () => {
        throw new TypeError("Failed to fetch");
      },
    });

    expect(await refreshSession()).toEqual(
      R.failure(new TypeError("Failed to fetch")),
    );
    answering(200);
    expect(await refreshSession()).toEqual(R.success(true));
  });
});
