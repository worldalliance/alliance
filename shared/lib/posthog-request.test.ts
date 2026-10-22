import {
  POSTHOG_DISTINCT_HEADER,
  POSTHOG_SESSION_HEADER,
  type PosthogContext,
} from "@alliance/common/posthog";
import { createClient } from "@hey-api/client-fetch";
import { hoursToMilliseconds, minutesToMilliseconds } from "date-fns";
import {
  liveSessionId,
  registerPosthogRequestContext,
} from "./posthog-request";

describe("PostHog API request context", () => {
  it("reads the current identifiers for every request and unregisters cleanly", async () => {
    const requests: Request[] = [];
    const client = createClient({
      baseUrl: "https://api.example.test",
      fetch: async (request) => {
        requests.push(new Request(request));
        return Response.json({});
      },
    });
    let context: PosthogContext | undefined;
    const unregister = registerPosthogRequestContext({
      client,
      getContext: () => context,
    });
    const send = () =>
      client.get({
        url: "/member",
        headers: { Authorization: "Bearer test-token" },
      });

    await send();
    context = {
      sessionId: "01900000-0000-7000-8000-000000000001",
      distinctId: "anonymous",
    };
    await send();
    context = {
      sessionId: "01900000-0000-7000-8000-000000000002",
      distinctId: "7",
    };
    await send();
    context = undefined;
    await send();
    unregister();
    context = {
      sessionId: "01900000-0000-7000-8000-000000000003",
      distinctId: "8",
    };
    await send();

    expect(
      requests.map((request) => request.headers.get(POSTHOG_SESSION_HEADER)),
    ).toEqual([
      null,
      "01900000-0000-7000-8000-000000000001",
      "01900000-0000-7000-8000-000000000002",
      null,
      null,
    ]);
    expect(
      requests.map((request) => request.headers.get(POSTHOG_DISTINCT_HEADER)),
    ).toEqual([null, "anonymous", "7", null, null]);
    expect(
      requests.every(
        (request) =>
          request.headers.get("Authorization") === "Bearer test-token",
      ),
    ).toBe(true);
  });

  it("lets the API request through if the analytics SDK throws", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const client = createClient({
      baseUrl: "https://api.example.test",
      fetch: async () => Response.json({ ok: true }),
    });
    const unregister = registerPosthogRequestContext({
      client,
      getContext: () => {
        throw new Error("SDK unavailable");
      },
    });
    try {
      const result = await client.get({ url: "/member" });
      expect(result.data).toEqual({ ok: true });
      expect(warn).toHaveBeenCalled();
    } finally {
      unregister();
      warn.mockRestore();
    }
  });
});

describe("liveSessionId", () => {
  const sessionId = "01900000-0000-7000-8000-000000000001";
  const stored = (ago: { idleMinutes: number; ageHours: number }) => ({
    sessionId,
    lastActive: Date.now() - minutesToMilliseconds(ago.idleMinutes),
    started: Date.now() - hoursToMilliseconds(ago.ageHours),
    idleTimeoutMs: minutesToMilliseconds(30),
  });

  it("returns a session within its limits", () => {
    expect(liveSessionId(stored({ idleMinutes: 29, ageHours: 23 }))).toBe(
      sessionId,
    );
  });

  it.each([
    { idleMinutes: 31, ageHours: 1 },
    { idleMinutes: 0, ageHours: 25 },
  ])("drops a session past its limits: %j", (ago) => {
    expect(liveSessionId(stored(ago))).toBeUndefined();
  });

  it("drops a session the SDK has not stored", () => {
    expect(
      liveSessionId({
        sessionId: undefined,
        lastActive: undefined,
        started: undefined,
        idleTimeoutMs: minutesToMilliseconds(30),
      }),
    ).toBeUndefined();
  });
});
