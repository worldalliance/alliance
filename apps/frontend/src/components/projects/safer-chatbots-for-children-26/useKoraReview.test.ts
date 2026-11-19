import { SAMPLE_ITEMS } from "@alliance/kora-review/sample-export";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { beforeEach, expect, test } from "bun:test";
import { nextKoraConversation, setKoraPreferences } from "./useKoraReview";

let nextBody: unknown;
let preferences: unknown[];
let paths: string[];

serveApi(
  routes({
    "POST /kora/review/sessions/:id/next": ({ params }) => {
      paths.push(params.id);
      return Response.json(nextBody);
    },
    "PATCH /kora/review/preferences": async ({ request }) => {
      preferences.push(await request.json());
      return new Response(null, { status: 204 });
    },
  }),
);

beforeEach(() => {
  nextBody = { item: SAMPLE_ITEMS[1] };
  preferences = [];
  paths = [];
});

test("asks the reviewer's own session for the next conversation", async () => {
  const next = await nextKoraConversation("ses1");
  expect(paths).toEqual(["ses1"]);
  expect("item" in next && next.item.conversationId).toBe(
    SAMPLE_ITEMS[1].conversationId,
  );
});

test("passes on why a session is over", async () => {
  nextBody = { done: "queue_empty" };
  expect(await nextKoraConversation("ses1")).toEqual({ done: "queue_empty" });
  nextBody = { done: "budget_spent" };
  expect(await nextKoraConversation("ses1")).toEqual({ done: "budget_spent" });
});

test("treats an unknown reason for ending as a spent budget", async () => {
  nextBody = { done: "something else" };
  expect(await nextKoraConversation("ses1")).toEqual({ done: "budget_spent" });
});

test("sends the preferences the reviewer changed", async () => {
  await setKoraPreferences({ optOutRisks: ["self_harm"] });
  await setKoraPreferences({ extendedOptIn: true });
  expect(preferences).toEqual([
    { optOutRisks: ["self_harm"] },
    { extendedOptIn: true },
  ]);
});
