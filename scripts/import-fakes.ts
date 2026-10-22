import fs from "node:fs";
import path from "node:path";
import { devPorts, PortCaller } from "../common/src/dev-ports";
import { mintAccessToken } from "./lib/access-token";
import {
  dateShifter,
  type FakeEvent,
  type FakeFile,
  fakeFileSchema,
  FakeKind,
  Outcome,
  type Participant,
  splitEvents,
} from "./lib/fakes";
import { execLocalDb, queryLocalDb } from "./lib/local-db";

const FAKES_DIR = path.join(import.meta.dirname, "..", ".scratch", "fakes");
const API = `http://localhost:${devPorts(PortCaller.Tooling).server}`;
const now = new Date();
const failures: string[] = [];

const tokens = new Map<number, string>();
async function api<T>(params: {
  as: number;
  method: string;
  route: string;
  body?: unknown;
}): Promise<T> {
  if (!tokens.has(params.as)) tokens.set(params.as, mintAccessToken(params.as));
  const response = await fetch(`${API}${params.route}`, {
    method: params.method,
    headers: {
      Authorization: `Bearer ${tokens.get(params.as)}`,
      "Content-Type": "application/json",
    },
    body: params.body === undefined ? undefined : JSON.stringify(params.body),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `${params.method} ${params.route} as ${params.as}: ${response.status} ${text}`,
    );
  }
  return JSON.parse(text || "null");
}

function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function loadFiles(): { file: string; fake: FakeFile }[] {
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

function actionIdByName(name: string): number | null {
  const [row] = queryLocalDb<{ id: number }>(
    `SELECT id FROM action WHERE name = ${sqlString(name)} AND "deletedAt" IS NULL`,
  );
  return row?.id ?? null;
}

async function createFakeAction(params: {
  admin: number;
  fake: Extract<FakeFile, { kind: FakeKind.Fake }>;
}): Promise<number> {
  const { admin, fake } = params;
  const form = await api<{ id: number }>({
    as: admin,
    method: "POST",
    route: "/tasks/createForm",
    body: fake.action.form,
  });
  const { form: _, ...fields } = fake.action;
  const action = await api<{ id: number }>({
    as: admin,
    method: "POST",
    route: "/actions/create",
    body: {
      ...fields,
      taskFormId: form.id,
      isContractSigningAction: false,
      onboarding: false,
      optional: false,
      preventCompletion: false,
      publicOnly: false,
      shouldCompleteAfterDeadline: false,
      isForumParticipationAction: false,
    },
  });
  if (fake.project) {
    await assignProject({ admin, actionId: action.id, project: fake.project });
  }
  return action.id;
}

async function assignProject(params: {
  admin: number;
  actionId: number;
  project: { name: string; category: string[] };
}): Promise<void> {
  const { admin, project } = params;
  const projects = await api<{ id: number; name: string }[]>({
    as: admin,
    method: "GET",
    route: "/projects",
  });
  let projectId = projects.find((p) => p.name === project.name)?.id;
  if (projectId === undefined) {
    projectId = (
      await api<{ id: number }>({
        as: admin,
        method: "POST",
        route: "/projects",
        body: { name: project.name },
      })
    ).id;
    await api({
      as: admin,
      method: "PATCH",
      route: `/projects/${projectId}`,
      body: { category: project.category },
    });
  }
  await api({
    as: admin,
    method: "PUT",
    route: `/projects/actions/${params.actionId}`,
    body: { projectId },
  });
}

async function addEvents(params: {
  admin: number;
  actionId: number;
  events: FakeEvent[];
  shift: (iso: string) => Date;
}): Promise<void> {
  const existing = queryLocalDb<{ title: string; newStatus: string }>(
    `SELECT title, "newStatus" FROM action_event
     WHERE "actionId" = ${params.actionId} AND "deletedAt" IS NULL`,
  );
  for (const event of params.events) {
    if (
      existing.some(
        (e) => e.title === event.title && e.newStatus === event.newStatus,
      )
    ) {
      continue;
    }
    await api({
      as: params.admin,
      method: "POST",
      route: `/actions/${params.actionId}/events?acknowledgeDeadlineShortening=true`,
      body: { ...event, date: params.shift(event.date).toISOString() },
    });
  }
}

interface ActionContext {
  actionId: number;
  formId: number;
  formSnapshotId: number;
  eligible: Set<number>;
  acted: Set<number>;
  contracted: Set<number>;
}

async function actionContext(params: {
  admin: number;
  actionId: number;
}): Promise<ActionContext> {
  const [action] = queryLocalDb<{
    taskFormId: number;
    cohortExpression: unknown;
  }>(
    `SELECT "taskFormId", "cohortExpression" FROM action WHERE id = ${params.actionId}`,
  );
  const { formSnapshotId } = await api<{ formSnapshotId: number }>({
    as: params.admin,
    method: "GET",
    route: `/tasks/slug/${action.taskFormId}`,
  });
  const { userIds } = await api<{ userIds: number[] }>({
    as: params.admin,
    method: "POST",
    route: "/actions/evaluate-cohort",
    body: { expression: action.cohortExpression },
  });
  const excluded = new Set(
    queryLocalDb<{ id: number }>(
      `SELECT id FROM "user" WHERE admin OR anonymous OR "isTestUser"`,
    ).map((row) => row.id),
  );
  const acted = new Set(
    queryLocalDb<{ userId: number }>(
      `SELECT DISTINCT "userId" FROM action_activity
       WHERE "actionId" = ${params.actionId} AND "deletedAt" IS NULL`,
    ).map((row) => row.userId),
  );
  return {
    actionId: params.actionId,
    formId: action.taskFormId,
    formSnapshotId,
    eligible: new Set(userIds.filter((id) => !excluded.has(id))),
    acted,
    contracted: activeContractIds(),
  };
}

/**
 * The recorded member, or a stand-in when they're gone or out of the cohort.
 * Null when the recorded member already acted, as on a second import.
 */
function castMember(params: {
  context: ActionContext;
  recorded: number;
}): number | null {
  const { context, recorded } = params;
  if (context.acted.has(recorded)) return null;
  if (context.eligible.has(recorded)) return recorded;
  const pool = [...context.eligible].filter((id) => !context.acted.has(id));
  const signed = pool.filter((id) => context.contracted.has(id));
  const choices = signed.length > 0 ? signed : pool;
  const standIn = choices[Math.floor(Math.random() * choices.length)];
  if (standIn === undefined) throw new Error("no eligible member left");
  console.log(`  member ${standIn} stands in for ${recorded}`);
  return standIn;
}

function activeContractIds(): Set<number> {
  return new Set(
    queryLocalDb<{ userId: number }>(
      `SELECT "userId" FROM (
         SELECT DISTINCT ON ("userId") "userId", type FROM contract_event
         WHERE "deletedAt" IS NULL AND date <= now()
         ORDER BY "userId", date DESC, id DESC
       ) latest WHERE type = 'signed'`,
    ).map((row) => row.userId),
  );
}

/** Signing announces the member to their community, as a real signup does. */
async function signContract(userId: number): Promise<void> {
  const [{ name }] = queryLocalDb<{ name: string }>(
    `SELECT name FROM "user" WHERE id = ${userId}`,
  );
  const contract = await api<{ id: number }>({
    as: userId,
    method: "GET",
    route: "/contract/current",
  });
  await api({
    as: userId,
    method: "POST",
    route: `/contract/sign/${contract.id}`,
    body: { signedName: name },
  });
}

async function replayParticipant(params: {
  context: ActionContext;
  participant: Participant;
  shift: (iso: string) => Date;
}): Promise<void> {
  const { context, participant } = params;
  const userId = castMember({ context, recorded: participant.userId });
  if (userId === null) return;
  context.acted.add(userId);

  if (!context.contracted.has(userId)) {
    await signContract(userId);
    context.contracted.add(userId);
  }
  await api({ as: userId, method: "GET", route: "/actions/loggedIn" });
  const submission = (
    answers: Record<string, unknown>,
    deviceType: string,
  ) => ({
    answers,
    actionId: context.actionId,
    deviceType,
    formSnapshotId: context.formSnapshotId,
  });
  switch (participant.outcome) {
    case Outcome.Completed:
      await api({
        as: userId,
        method: "POST",
        route: `/tasks/submitForm/${context.formId}`,
        body: submission(participant.answers, participant.deviceType),
      });
      break;
    case Outcome.Withdrew:
      await api({
        as: userId,
        method: "POST",
        route: `/tasks/optout/${context.formId}`,
        body: {
          actionId: context.actionId,
          reason: participant.reason,
          outOfTime: participant.outOfTime,
          isMoral: participant.isMoral,
          partialFormData: submission({}, participant.deviceType),
        },
      });
      break;
    case Outcome.Dismissed:
      await api({
        as: userId,
        method: "POST",
        route: `/actions/dismiss/${context.actionId}`,
      });
      break;
    case Outcome.Idle:
      return;
    default:
      throw new Error(`unknown outcome: ${participant satisfies never}`);
  }

  const at = sqlString(params.shift(participant.at).toISOString());
  execLocalDb(
    `UPDATE action_activity SET "createdAt" = ${at}
     WHERE "actionId" = ${context.actionId} AND "userId" = ${userId}`,
  );
  execLocalDb(
    `UPDATE form_response SET "createdAt" = ${at}
     WHERE "formId" = ${context.formId} AND "userId" = ${userId}`,
  );
}

async function postUpdates(params: {
  admin: number;
  actionId: number;
  updates: FakeFile["updates"];
  shift: (iso: string) => Date;
}): Promise<void> {
  const existing = new Set(
    queryLocalDb<{ title: string }>(
      `SELECT title FROM action_update
       WHERE "actionId" = ${params.actionId} AND "deletedAt" IS NULL`,
    ).map((row) => row.title),
  );
  for (const update of params.updates) {
    if (existing.has(update.title)) continue;
    const date = params.shift(update.date).toISOString();
    const created = await api<{ id: number; schemaSnapshotId: number }>({
      as: params.admin,
      method: "POST",
      route: `/actions/createUpdate/${params.actionId}`,
      body: {
        title: update.title,
        shortNotifString: update.shortNotifString,
        date,
        notifyType: "none",
      },
    });
    await api({
      as: params.admin,
      method: "PATCH",
      route: `/actions/updateUpdate/${created.id}`,
      body: {
        schema: { blocks: update.blocks },
        expectedSchemaSnapshotId: created.schemaSnapshotId,
      },
    });
    execLocalDb(
      `UPDATE action_update SET date = ${sqlString(date)}, "visibleAt" = ${sqlString(date)}
       WHERE id = ${created.id}`,
    );
  }
}

async function importFake(params: {
  admin: number;
  file: string;
  fake: FakeFile;
}): Promise<string> {
  const { admin, fake } = params;
  const existingId = actionIdByName(fake.action.name);
  let actionId: number;
  switch (fake.kind) {
    case FakeKind.Fake:
      if (existingId !== null) return `skipped, action ${existingId} exists`;
      actionId = await createFakeAction({ admin, fake });
      break;
    case FakeKind.Staging:
      if (existingId === null) return "skipped, no action with that name";
      actionId = existingId;
      break;
    default:
      throw new Error(`unknown kind: ${fake satisfies never}`);
  }

  const shift = dateShifter({ recordedAt: fake.recordedAt, now });
  const { before, after } = splitEvents({ events: fake.events, shift, now });
  await addEvents({ admin, actionId, events: before, shift });

  if (fake.participants.length > 0) {
    const context = await actionContext({ admin, actionId });
    const ordered = fake.participants.toSorted(
      (a, b) => Date.parse(a.at) - Date.parse(b.at),
    );
    for (const participant of ordered) {
      try {
        await replayParticipant({ context, participant, shift });
      } catch (error) {
        failures.push(`${params.file} member ${participant.userId}: ${error}`);
      }
    }
  }

  await postUpdates({ admin, actionId, updates: fake.updates, shift });
  await addEvents({ admin, actionId, events: after, shift });
  return `action ${actionId}`;
}

const files = loadFiles();
if (process.argv.includes("--check")) {
  console.log(`${files.length} fake files valid`);
  process.exit(0);
}

const [admin] = queryLocalDb<{ id: number }>(
  `SELECT id FROM "user" WHERE admin ORDER BY id LIMIT 1`,
);
if (!admin) throw new Error("no admin user in the local db");

for (const { file, fake } of files) {
  try {
    console.log(
      `${file}: ${await importFake({ admin: admin.id, file, fake })}`,
    );
  } catch (error) {
    failures.push(`${file}: ${error}`);
  }
}
if (failures.length > 0) {
  console.error(`\n${failures.length} failed:\n${failures.join("\n")}`);
  process.exit(1);
}
