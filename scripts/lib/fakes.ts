import fs from "node:fs";
import path from "node:path";
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

const form = z.strictObject({
  title: z.string(),
  schema: z.record(z.string(), z.unknown()),
});

const branch = z.strictObject({
  name: z.string(),
  rule: z.unknown(),
  nameOverride: z.string().nullable(),
  shortDescriptionOverride: z.string().nullable(),
  bodyOverride: z.string().nullable(),
  timeEstimateOverride: z.int().nullable(),
  form,
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
      imagePrompt: z.string().min(1),
      action: z.strictObject({
        name: z.string(),
        shortDescription: z.string(),
        body: z.string(),
        category: z.array(z.string()),
        timeEstimate: z.int(),
        cohortExpression: z.unknown(),
        visibilityMode: z.string(),
        form,
        branches: z.array(branch).optional(),
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

export const FAKES_DIR = path.join(
  import.meta.dirname,
  "..",
  "..",
  ".scratch",
  "fakes",
);

export function loadFakeFiles(): { file: string; fake: FakeFile }[] {
  if (!fs.existsSync(FAKES_DIR)) return [];
  const problems: string[] = [];
  const loaded = fs
    .readdirSync(FAKES_DIR)
    .filter((name) => name.endsWith(".yml"))
    .sort()
    .flatMap((name) => {
      const parsed = fakeFileSchema.safeParse(
        Bun.YAML.parse(fs.readFileSync(path.join(FAKES_DIR, name), "utf8")),
      );
      if (parsed.success) return [{ file: name, fake: parsed.data }];
      problems.push(`${name}: ${parsed.error.message}`);
      return [];
    });
  if (problems.length > 0) throw new Error(problems.join("\n"));
  return loaded;
}

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

export interface RecordedTimes {
  events: { title: string; newStatus: string; date: string }[];
  activityByUser: Map<number, string>;
  updateByTitle: Map<string, string>;
}

/**
 * Rewrites a file's dates to the db's after its action moved, so an import
 * lands the action where it now sits. Anything the db lacks, such as an idle
 * member, moves by `deltaMs`.
 */
export function syncFileDates(params: {
  file: FakeFile;
  db: RecordedTimes;
  deltaMs: number;
  now: Date;
}): FakeFile {
  const { file, db } = params;
  const shifted = (iso: string) =>
    new Date(Date.parse(iso) + params.deltaMs).toISOString();
  return {
    ...file,
    recordedAt: params.now.toISOString(),
    events: file.events.map((event) => ({
      ...event,
      date:
        db.events.find(
          (e) => e.title === event.title && e.newStatus === event.newStatus,
        )?.date ?? shifted(event.date),
    })),
    participants: file.participants.map((participant) => ({
      ...participant,
      at: db.activityByUser.get(participant.userId) ?? shifted(participant.at),
    })),
    updates: file.updates.map((update) => ({
      ...update,
      date: db.updateByTitle.get(update.title) ?? shifted(update.date),
    })),
  };
}
