import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { fakeFileSchema, syncFileDates } from "./lib/fakes";
import { execLocalDb, queryLocalDb } from "./lib/local-db";

const { values, positionals } = parseArgs({
  options: {
    launch: { type: "string" },
    live: { type: "boolean", default: false },
    "spread-after": { type: "string" },
    record: { type: "boolean", default: false },
  },
  allowPositionals: true,
});
const actionId = Number(positionals[0]);
const requested = values.launch ? new Date(values.launch) : null;
if (
  !Number.isInteger(actionId) ||
  values.live === (requested !== null) ||
  (requested !== null && Number.isNaN(requested.getTime()))
) {
  console.error(
    "usage: bun scripts/shift-action.ts <actionId> (--launch <ISO date> | --live) [--spread-after <activityId>] [--record]",
  );
  process.exit(2);
}

const [action] = queryLocalDb<{ name: string; suiteId: number | null }>(
  `SELECT name, "suiteId" FROM action WHERE id = ${actionId} AND "deletedAt" IS NULL`,
);
if (!action) throw new Error(`no action ${actionId}`);
if (action.suiteId !== null) {
  throw new Error(
    `action ${actionId} is in suite ${action.suiteId}; move it with the suite routes so its general updates follow`,
  );
}
const events = queryLocalDb<{ date: string; newStatus: string }>(
  `SELECT date, "newStatus" FROM action_event WHERE "actionId" = ${actionId} AND "deletedAt" IS NULL`,
);
const memberAction = events.find((e) => e.newStatus === "member_action");
if (!memberAction)
  throw new Error(`action ${actionId} has no member_action event`);

const now = new Date();
const [{ latest }] = queryLocalDb<{ latest: string | null }>(
  `SELECT max("createdAt") AS latest FROM action_activity WHERE "actionId" = ${actionId}`,
);
const sinceLaunch = latest
  ? Date.parse(latest) - Date.parse(memberAction.date)
  : 0;
// As late as existing activity allows, so as much of the member phase as possible is still ahead.
const launch =
  requested ?? new Date(now.getTime() - Math.max(sinceLaunch, 0) - 60_000);
const deltaMs = launch.getTime() - Date.parse(memberAction.date);
const shift = (column: string) =>
  `"${column}" = "${column}" + interval '${deltaMs} milliseconds'`;
if (latest && Date.parse(latest) + deltaMs > now.getTime()) {
  throw new Error("that move would put existing activity in the future");
}

const eventDates = events.map((event) => Date.parse(event.date) + deltaMs);
if (
  values.live &&
  eventDates.some((date) => date > launch.getTime() && date <= now.getTime())
) {
  throw new Error(
    `action ${actionId} can't be made live: its existing activity outlasts its member phase`,
  );
}

const responsesOf = `SELECT "taskFormResponseId" FROM action_activity
  WHERE "actionId" = ${actionId} AND "taskFormResponseId" IS NOT NULL`;
execLocalDb(`BEGIN;
  UPDATE action_event SET ${shift("date")} WHERE "actionId" = ${actionId};
  UPDATE action_activity SET ${shift("createdAt")} WHERE "actionId" = ${actionId};
  UPDATE form_response SET ${shift("createdAt")} WHERE id IN (${responsesOf});
  UPDATE action_update SET ${shift("date")}, ${shift("visibleAt")}, ${shift("notifiedAt")}
    WHERE "actionId" = ${actionId};
  UPDATE action_cohort_decision SET ${shift("resolvedAt")} WHERE "actionId" = ${actionId};
  ${
    // Exclusions made only because the phase had closed. Deleted, not soft-deleted:
    // the unique (actionId, userId) index covers soft-deleted rows, so they would
    // block the member feed's fresh decision.
    values.live
      ? `DELETE FROM action_cohort_decision WHERE "actionId" = ${actionId}
           AND reason = 'resolved_after_deadline';`
      : ""
  }
COMMIT;`);

const spreadAfter = values["spread-after"];
if (spreadAfter !== undefined) {
  if (!Number.isInteger(Number(spreadAfter))) {
    throw new Error("--spread-after takes an action_activity id");
  }
  const [{ phaseEnd }] = queryLocalDb<{ phaseEnd: string | null }>(
    `SELECT min(date) AS "phaseEnd" FROM action_event WHERE "actionId" = ${actionId}
     AND "deletedAt" IS NULL AND date > '${launch.toISOString()}'`,
  );
  const end = new Date(
    Math.min(phaseEnd ? Date.parse(phaseEnd) : Infinity, now.getTime()),
  );
  const span = `interval '${Math.max(end.getTime() - launch.getTime(), 0)} milliseconds'`;
  execLocalDb(`BEGIN;
    UPDATE action_activity SET "createdAt" = '${launch.toISOString()}'::timestamptz + random() * ${span}
      WHERE "actionId" = ${actionId} AND id > ${spreadAfter};
    UPDATE form_response r SET "createdAt" = a."createdAt" FROM action_activity a
      WHERE a."taskFormResponseId" = r.id AND a."actionId" = ${actionId} AND a.id > ${spreadAfter};
  COMMIT;`);
}

if (values.record) {
  const dir = path.join(import.meta.dirname, "..", ".scratch", "fakes");
  const files = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => f.endsWith(".yml"))
    : [];
  const match = files.find(
    (f) =>
      fakeFileSchema.parse(
        Bun.YAML.parse(fs.readFileSync(path.join(dir, f), "utf8")),
      ).action.name === action.name,
  );
  if (!match) throw new Error(`no file in ${dir} records "${action.name}"`);
  const file = path.join(dir, match);
  const events = queryLocalDb<{
    title: string;
    newStatus: string;
    date: string;
  }>(
    `SELECT title, "newStatus", date FROM action_event WHERE "actionId" = ${actionId} AND "deletedAt" IS NULL`,
  );
  const activity = queryLocalDb<{ userId: number; at: string }>(
    `SELECT "userId", min("createdAt") AS at FROM action_activity
     WHERE "actionId" = ${actionId} AND "deletedAt" IS NULL GROUP BY "userId"`,
  );
  const updates = queryLocalDb<{ title: string; date: string }>(
    `SELECT title, date FROM action_update WHERE "actionId" = ${actionId} AND "deletedAt" IS NULL`,
  );
  const synced = syncFileDates({
    file: fakeFileSchema.parse(Bun.YAML.parse(fs.readFileSync(file, "utf8"))),
    db: {
      events,
      activityByUser: new Map(activity.map((a) => [a.userId, a.at])),
      updateByTitle: new Map(updates.map((u) => [u.title, u.date])),
    },
    deltaMs,
    now,
  });
  fs.writeFileSync(file, JSON.stringify(fakeFileSchema.parse(synced), null, 2));
  console.log(`recorded in ${match}`);
}

console.log(
  `action ${actionId} moved by ${(deltaMs / 864e5).toFixed(2)} days; launch is ${launch.toISOString()}`,
);
if (values.live) {
  const closes = Math.min(
    ...eventDates.filter((date) => date > launch.getTime()),
  );
  console.log(
    `member phase open for ${((closes - now.getTime()) / 36e5).toFixed(1)} more hours`,
  );
}
