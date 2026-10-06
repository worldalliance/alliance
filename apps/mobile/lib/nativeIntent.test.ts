import { MOBILE_OAUTH_RETURN_URL } from "@alliance/common/oauth";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { z } from "zod";
import { redirectSystemPath } from "../app/+native-intent";
import { linkOpenings } from "./linkOpenings";
import { memoryAsyncStorage } from "./memoryAsyncStorage";

const sent: string[] = [];

serveApi(
  routes({
    "POST /link-openings": async ({ request }) => {
      const { trackingId } = z
        .object({ trackingId: z.string() })
        .parse(await request.json());
      sent.push(trackingId);
      return new Response(null, { status: 204 });
    },
  }),
);

beforeEach(memoryAsyncStorage);
afterEach(() => jest.restoreAllMocks());

const sendQueued = async () => {
  await linkOpenings.start();
  await linkOpenings.flush();
};

test("records a tracked link and routes to it without its tracking ID", async () => {
  expect(
    await redirectSystemPath({
      path: "https://thealliance.org/tasks?tab=done&cid=intent-1",
      initial: true,
    }),
  ).toBe("https://thealliance.org/tasks?tab=done");

  await sendQueued();

  expect(sent).toContain("intent-1");
});

test("keeps a waiting sign-in's return link out of the router unrecorded", async () => {
  expect(
    redirectSystemPath({
      path: `${MOBILE_OAUTH_RETURN_URL}?handoff=abc&cid=intent-2`,
      initial: false,
    }),
  ).toBeNull();

  await sendQueued();

  expect(sent).not.toContain("intent-2");
});
