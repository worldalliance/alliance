import { renderHook } from "@testing-library/react";
import { milliseconds } from "date-fns";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import { useActionShareUrl } from "./useActionShareUrl";

let requests: string[] = [];
let failing = false;

serveApi(
  routes({
    "POST /actions/:id/referralCode": ({ params }) => {
      requests.push(params.id);
      return failing
        ? Response.json({ message: "nope" }, { status: 500 })
        : Response.json({ referralCode: `code/${params.id}` });
    },
  }),
);

beforeEach(() => {
  requests = [];
  failing = false;
});

// Defaults that would retry and evict, so the tests see the hook's own options.
const render = () => {
  const query = queryWrapper({ retry: 3, gcTime: 0 });
  const actionShareUrl = renderHook(() => useActionShareUrl(), query).result
    .current;
  return { actionShareUrl, client: query.client };
};

const baseUrl = "https://example.org";

const nextTask = () => new Promise((resolve) => setTimeout(resolve, 10));

it("asks for the member's code on the first share of each action and reuses it", async () => {
  const { actionShareUrl, client } = render();
  expect(client.getQueryCache().getAll()).toEqual([]);

  expect(
    await actionShareUrl({ actionId: 5, baseUrl, isAuthenticated: true }),
  ).toBe("https://example.org/actions/5?sid=code%2F5");
  await nextTask();
  expect(
    await actionShareUrl({ actionId: 5, baseUrl, isAuthenticated: true }),
  ).toBe("https://example.org/actions/5?sid=code%2F5");
  expect(
    await actionShareUrl({ actionId: 6, baseUrl, isAuthenticated: true }),
  ).toBe("https://example.org/actions/6?sid=code%2F6");
  expect(requests).toEqual(["5", "6"]);
});

it("asks again once the cached code is an hour old", async () => {
  const { actionShareUrl } = render();
  await actionShareUrl({ actionId: 5, baseUrl, isAuthenticated: true });

  const later = Date.now() + milliseconds({ hours: 1, seconds: 1 });
  jest.spyOn(Date, "now").mockReturnValue(later);
  await actionShareUrl({ actionId: 5, baseUrl, isAuthenticated: true });

  expect(requests).toEqual(["5", "5"]);
});

it("gives a signed-out visitor the plain URL without asking", async () => {
  const { actionShareUrl } = render();

  expect(
    await actionShareUrl({ actionId: 5, baseUrl, isAuthenticated: false }),
  ).toBe("https://example.org/actions/5");
  expect(requests).toEqual([]);
});

it("falls back to the plain URL at once on failure, logs, and asks again next time", async () => {
  const logged = jest.spyOn(console, "error").mockImplementation(() => {});
  const { actionShareUrl } = render();
  failing = true;

  expect(
    await actionShareUrl({ actionId: 5, baseUrl, isAuthenticated: true }),
  ).toBe("https://example.org/actions/5");
  expect(requests).toEqual(["5"]);
  expect(logged).toHaveBeenCalledWith(
    "failed to load the action referral code",
    expect.anything(),
  );

  failing = false;
  expect(
    await actionShareUrl({ actionId: 5, baseUrl, isAuthenticated: true }),
  ).toBe("https://example.org/actions/5?sid=code%2F5");
  expect(requests).toEqual(["5", "5"]);
});
