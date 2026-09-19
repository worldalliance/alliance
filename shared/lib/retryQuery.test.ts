import { useQuery } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { client } from "../client/client.gen";
import { retryUnlessRefused } from "./retryQuery";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi, type RouteTable } from "./testing/serveApi";

let attempts = 0;

const reads = {
  "GET /answered/:status": ({ params }) => {
    attempts += 1;
    const statusCode = Number(params.status);
    return Response.json({ statusCode, message: "no" }, { status: statusCode });
  },
  // A refusal built from an object literal, which NestJS answers verbatim,
  // so the status reaching the rule is the one the interceptor put there.
  "GET /unshaped": () => {
    attempts += 1;
    return Response.json({ message: "no" }, { status: 403 });
  },
  "GET /unreachable": () => {
    attempts += 1;
    throw new TypeError("Failed to fetch");
  },
} satisfies RouteTable;

const api = serveApi(routes(reads));

beforeEach(() => {
  attempts = 0;
  api.throwingOnRefusal(reads);
});

const attemptsFor = async (url: string) => {
  const { wrapper } = queryWrapper({
    retry: retryUnlessRefused(3),
    retryDelay: 0,
  });
  const query = renderHook(
    () => useQuery({ queryKey: [url], queryFn: () => client.get({ url }) }),
    { wrapper },
  );

  await waitFor(() => expect(query.result.current.isError).toBe(true));
  return attempts;
};

it.each([400, 401, 403, 404])(
  "asks once for a read the server refused with %i",
  async (statusCode) => {
    expect(await attemptsFor(`/answered/${statusCode}`)).toBe(1);
  },
);

it.each([408, 429, 500])(
  "asks again after a %i, which a later attempt can still satisfy",
  async (statusCode) => {
    expect(await attemptsFor(`/answered/${statusCode}`)).toBe(4);
  },
);

it("asks once for a refusal whose body carries no statusCode", async () => {
  expect(await attemptsFor("/unshaped")).toBe(1);
});

it("asks again after a request that never reached the server", async () => {
  expect(await attemptsFor("/unreachable")).toBe(4);
});
