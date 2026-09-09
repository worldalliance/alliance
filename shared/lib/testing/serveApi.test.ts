import { client } from "../../client/client.gen";
import { endServedTest, routes, serveApi, UnroutedRequest } from "./serveApi";

const untouched = client.getConfig();

const api = serveApi(
  routes({
    "GET /probe/:name": ({ params }) => Response.json({ name: params.name }),
    "GET /refuse": () => Response.json({ message: "no" }, { status: 403 }),
  }),
);

it("answers the client from the route the request matched", async () => {
  const { data } = await client.get({ url: "/probe/one" });

  expect(data).toEqual({ name: "one" });
});

it("records a request no route matched, and throws it from the restore", async () => {
  await client.get({ url: "/nowhere" }).catch(() => {});

  expect(() => endServedTest()).toThrow(UnroutedRequest);
});

it("records a request the table names under another verb", async () => {
  await client.post({ url: "/probe/one" }).catch(() => {});

  expect(() => endServedTest()).toThrow(UnroutedRequest);
});

it("refuses a route naming no method and path", () => {
  expect(() => routes({ "/probe": () => new Response() })).toThrow(
    "route names no path",
  );
});

it("throws the refusal where the test asked the client to", async () => {
  api.throwingOnRefusal({
    "GET /probe/:name": () => Response.json({ message: "no" }, { status: 403 }),
  });

  await expect(client.get({ url: "/probe/one" })).rejects.toEqual({
    message: "no",
  });
});

// Has to follow a throwing test: a beforeEach that stopped reinstalling the
// base handler would leave that throwing config answering the rest of the file.
it("serves the base handler again after a throwing test", async () => {
  const { error } = await client.get({ url: "/refuse" });

  expect(error).toEqual({ message: "no" });
});

// Has to stay last: ending on the base handler leaves throwOnError already
// false, and afterAll below passes with the line restoring it deleted.
it("leaves the throwing config for the restore to take off", async () => {
  api.throwingOnRefusal({
    "GET /probe/:name": () => Response.json({ message: "no" }, { status: 403 }),
  });

  await expect(client.get({ url: "/probe/one" })).rejects.toEqual({
    message: "no",
  });
});

afterAll(() => {
  const config = client.getConfig();

  expect(config.fetch).toBe(untouched.fetch);
  expect(config.baseUrl).toBe(untouched.baseUrl);
  expect(config.throwOnError).toBe(untouched.throwOnError);
});
