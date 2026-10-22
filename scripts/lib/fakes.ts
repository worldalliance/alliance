import { z } from "zod";
import { deviceVisibilityTargetSchema } from "../../common/src/forms/device";

export enum FakeKind {
  Fake = "fake",
  Staging = "staging",
}

export enum Outcome {
  Completed = "completed",
  Withdrew = "withdrew",
  Dismissed = "dismissed",
  Idle = "idle",
}

const date = z.iso.datetime({ offset: true });

const event = z.strictObject({
  title: z.string(),
  description: z.string(),
  newStatus: z.string(),
  date,
});

const participantBase = { userId: z.int(), at: date };

const participant = z.discriminatedUnion("outcome", [
  z.strictObject({
    ...participantBase,
    outcome: z.literal(Outcome.Completed),
    deviceType: deviceVisibilityTargetSchema,
    answers: z.record(z.string(), z.unknown()),
  }),
  z.strictObject({
    ...participantBase,
    outcome: z.literal(Outcome.Withdrew),
    deviceType: deviceVisibilityTargetSchema,
    reason: z.string(),
    outOfTime: z.boolean(),
    isMoral: z.boolean(),
  }),
  z.strictObject({ ...participantBase, outcome: z.literal(Outcome.Dismissed) }),
  z.strictObject({ ...participantBase, outcome: z.literal(Outcome.Idle) }),
]);

const update = z.strictObject({
  title: z.string(),
  shortNotifString: z.string(),
  date,
  blocks: z.array(z.unknown()),
});

const engagement = {
  recordedAt: date,
  events: z.array(event),
  participants: z.array(participant),
  updates: z.array(update),
};

export const fakeFileSchema = z
  .discriminatedUnion("kind", [
    z.strictObject({
      kind: z.literal(FakeKind.Fake),
      ...engagement,
      action: z.strictObject({
        name: z.string(),
        shortDescription: z.string(),
        body: z.string(),
        category: z.array(z.string()),
        timeEstimate: z.int(),
        cohortExpression: z.unknown(),
        visibilityMode: z.string(),
        form: z.strictObject({
          title: z.string(),
          schema: z.record(z.string(), z.unknown()),
        }),
      }),
      project: z
        .strictObject({ name: z.string(), category: z.array(z.string()) })
        .nullable(),
    }),
    z.strictObject({
      kind: z.literal(FakeKind.Staging),
      ...engagement,
      action: z.strictObject({ name: z.string() }),
    }),
  ])
  .superRefine((file, ctx) => {
    const late = [
      ...file.participants,
      ...file.updates.map((u) => ({ at: u.date })),
    ]
      .map((entry) => entry.at)
      .filter((at) => Date.parse(at) > Date.parse(file.recordedAt));
    if (late.length > 0) {
      ctx.addIssue({
        code: "custom",
        message: `activity dated after recordedAt: ${late.join(", ")}`,
      });
    }
  });

export type FakeFile = z.infer<typeof fakeFileSchema>;
export type Participant = FakeFile["participants"][number];
export type FakeEvent = FakeFile["events"][number];

/** Moves every recorded date by the same amount, landing `recordedAt` on `now`. */
export function dateShifter(params: {
  recordedAt: string;
  now: Date;
}): (iso: string) => Date {
  const delta = params.now.getTime() - Date.parse(params.recordedAt);
  return (iso) => new Date(Date.parse(iso) + delta);
}

const OPENING_STATUSES = new Set(["planned", "member_action"]);

/**
 * Events that already ended the member phase would refuse the replayed
 * submissions, so they wait until participants and updates are in.
 */
export function splitEvents(params: {
  events: FakeEvent[];
  shift: (iso: string) => Date;
  now: Date;
}): { before: FakeEvent[]; after: FakeEvent[] } {
  const closesInPast = (event: FakeEvent) =>
    !OPENING_STATUSES.has(event.newStatus) &&
    params.shift(event.date) <= params.now;
  return {
    before: params.events.filter((event) => !closesInPast(event)),
    after: params.events.filter(closesInPast),
  };
}
