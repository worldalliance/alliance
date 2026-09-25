import { ExceptionEvent } from "@alliance/common/analytics";
import type { FollowUpFormDto, SubmitFormDto } from "../client";
import {
  followUpDraftStorageKey,
  followUpFormIntro,
  submitFollowUpForm,
} from "./followUpForm";
import { recordExceptions } from "./testing/recordExceptions";
import { routes, serveApi } from "./testing/serveApi";

const api = serveApi(
  routes({
    "POST /tasks/submitFollowUpForm/:id": () => Response.json({}),
  }),
);

const data: SubmitFormDto = {
  answers: { q1: "yes" },
  formSnapshotId: 3,
  schemaSnapshot: {},
  actionId: 9,
  visibilityValidatorResults: { q1: true },
  deviceType: "desktop",
  publicAnswers: { q1: "yes" },
  phDistinctId: "ph-id",
  sessionReplayUrl: "https://replay.example.com/1",
  sid: "session-id",
};

const reported = recordExceptions();

describe("submitFollowUpForm", () => {
  it("posts the answers to the follow-up form", async () => {
    const bodies: unknown[] = [];
    api.alsoServing({
      "POST /tasks/submitFollowUpForm/:id": async ({ request, params }) => {
        bodies.push({ params, body: await request.json() });
        return Response.json({});
      },
    });

    const submitted = await submitFollowUpForm({
      followUpFormId: 5,
      actionId: 9,
      data,
    });

    expect(submitted.ok).toBe(true);
    expect(bodies).toEqual([
      {
        params: { id: "5" },
        body: {
          answers: { q1: "yes" },
          formSnapshotId: 3,
          visibilityValidatorResults: { q1: true },
          deviceType: "desktop",
          publicAnswers: { q1: "yes" },
          phDistinctId: "ph-id",
          sessionReplayUrl: "https://replay.example.com/1",
          sid: "session-id",
        },
      },
    ]);
  });

  it("reports a refused submission", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    api.alsoServing({
      "POST /tasks/submitFollowUpForm/:id": () =>
        Response.json({ message: "nope" }, { status: 400 }),
    });

    const submitted = await submitFollowUpForm({
      followUpFormId: 5,
      actionId: 9,
      data,
    });

    expect(submitted.ok).toBe(false);
    expect(reported).toEqual([
      {
        event: ExceptionEvent.FollowUpFormSubmitError,
        error: expect.anything(),
        properties: { actionId: 9, followUpFormId: 5 },
      },
    ]);
  });
});

describe("followUpDraftStorageKey", () => {
  it("names the draft the renderer saves under the follow-up's persist key", () => {
    expect(followUpDraftStorageKey({ formId: 2, followUpFormId: 5 })).toBe(
      "form:2:follow-up-5",
    );
  });
});

describe("followUpFormIntro", () => {
  const followUp = (
    overrides: Partial<Pick<FollowUpFormDto, "name" | "instructions">>,
  ) => ({ name: null, instructions: null, ...overrides });

  it("falls back to the form's title and hides blank instructions", () => {
    expect(
      followUpFormIntro(followUp({ instructions: "  " }), "Survey"),
    ).toEqual({ title: "Survey", hasInstructions: false, shown: true });
  });

  it("prefers the follow-up's own name and shows its instructions", () => {
    expect(
      followUpFormIntro(
        followUp({ name: "Check-in", instructions: "Tell us more" }),
        "Survey",
      ),
    ).toEqual({ title: "Check-in", hasInstructions: true, shown: true });
  });

  it("is hidden with no title and no instructions", () => {
    expect(followUpFormIntro(followUp({}), "").shown).toBe(false);
  });
});
