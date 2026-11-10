import { afterEach, beforeEach, expect, test } from "bun:test";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SOURCE = join(import.meta.dir, "sync_prod_to_staging.sh");

// flock exits 1, so a run the guard lets through stops at the lock and posts
// "another sync is already running".
const STUBS: Record<string, string> = {
  curl: `echo "$*" >> "$STATE/curl"`,
  date: `
    if [ "$*" = "-u +%s" ]; then echo "$FAKE_EPOCH"; else PATH="\${PATH#*:}" exec date "$@"; fi`,
  flock: "exit 1",
};

let home: string;
let bin: string;
let state: string;
let script: string;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "sync-prod-to-staging-"));
  bin = join(home, "bin");
  state = join(home, "state");
  mkdirSync(bin);
  mkdirSync(state);
  script = join(home, "sync_prod_to_staging.sh");
  writeFileSync(
    script,
    readFileSync(SOURCE, "utf8").replaceAll("/home/ec2-user", home),
  );
  writeFileSync(
    join(home, "db-sync.env"),
    "SLACK_WEBHOOK_URL=http://slack.invalid\nHEALTHCHECK_URL=http://hc.invalid/check\n",
  );
  for (const [name, body] of Object.entries(STUBS)) {
    writeFileSync(join(bin, name), `#!/usr/bin/env bash\n${body}\n`);
    chmodSync(join(bin, name), 0o755);
  }
});

afterEach(() => {
  rmSync(home, { recursive: true });
});

const DAY = 1440;

const epochDay = (day = 0) => 20_000 + day;

function epochMinute(params: { day?: number; at: string }) {
  const [hours, minutes] = params.at.split(":").map(Number);
  return epochDay(params.day) * DAY + hours * 60 + minutes;
}

function run(params: {
  scheduledAt?: string;
  day?: number;
  at: string;
  fakeEpoch?: string;
}) {
  const env: Record<string, string> = {
    PATH: `${bin}:${process.env.PATH}`,
    STATE: state,
    FAKE_EPOCH: params.fakeEpoch ?? String(epochMinute(params) * 60 + 17),
  };
  if (params.scheduledAt !== undefined) {
    env.SYNC_SCHEDULED_AT = params.scheduledAt;
  }
  const result = Bun.spawnSync(["bash", script], { stdin: "ignore", env });
  let curl = "";
  try {
    curl = readFileSync(join(state, "curl"), "utf8");
  } catch {}
  rmSync(join(state, "curl"), { force: true });
  return { exitCode: result.exitCode, curl };
}

const recordedDay = () =>
  readFileSync(join(home, "sync_prod_to_staging.slot"), "utf8").trim();

const REACHED_LOCK = "another sync is already running";
const OUTSIDE_WINDOW = "outside its window";
const DAY_TAKEN = "had already started";

// A guard bash abandons partway also reaches the lock, so each case checks the
// day the guard records as well.
test.each([
  ["at the scheduled minute", "10:30", "10:30", 0],
  ["4 minutes late", "10:30", "10:34", 0],
  ["past midnight", "23:58", "00:02", -1],
  ["at 08:09, which bash would read as octal", "08:09", "08:09", 0],
])(
  "sync_prod_to_staging.sh runs a scheduled start %s",
  (_, scheduledAt, at, slotDay) => {
    const result = run({ scheduledAt, at });
    expect(result.exitCode).toBe(0);
    expect(result.curl).toContain(REACHED_LOCK);
    expect(recordedDay()).toBe(String(epochDay(slotDay)));
  },
);

test.each([
  ["5 minutes late", "10:30", "10:35"],
  ["a minute early", "10:30", "10:29"],
  ["hours late", "10:30", "15:00"],
  ["past midnight and out of the window", "23:58", "00:03"],
])(
  "sync_prod_to_staging.sh skips a scheduled start %s without a ping",
  (_, scheduledAt, at) => {
    const result = run({ scheduledAt, at });
    expect(result.exitCode).toBe(0);
    expect(result.curl).toContain(OUTSIDE_WINDOW);
    expect(result.curl).toContain("systemd-run");
    expect(result.curl).not.toContain("hc.invalid");
  },
);

test("sync_prod_to_staging.sh skips a second start on the same day without a ping", () => {
  expect(run({ scheduledAt: "10:30", at: "10:30" }).curl).toContain(
    REACHED_LOCK,
  );
  const second = run({ scheduledAt: "10:30", at: "10:33" });
  expect(second.exitCode).toBe(0);
  expect(second.curl).toContain(DAY_TAKEN);
  expect(second.curl).not.toContain("hc.invalid");
});

test("sync_prod_to_staging.sh skips a start at a new schedule time on a day whose run started", () => {
  run({ scheduledAt: "10:30", at: "10:30" });
  expect(run({ scheduledAt: "12:00", at: "12:02" }).curl).toContain(DAY_TAKEN);
});

test("sync_prod_to_staging.sh runs the next day's run", () => {
  run({ scheduledAt: "10:30", at: "10:30" });
  expect(run({ scheduledAt: "10:30", day: 1, at: "10:30" }).curl).toContain(
    REACHED_LOCK,
  );
  expect(recordedDay()).toBe(String(epochDay(1)));
});

test("sync_prod_to_staging.sh treats the minutes after midnight as the day before it", () => {
  run({ scheduledAt: "23:58", at: "23:59" });
  expect(run({ scheduledAt: "23:58", day: 1, at: "00:01" }).curl).toContain(
    DAY_TAKEN,
  );
});

test("sync_prod_to_staging.sh never skips a run outside the service unit", () => {
  run({ scheduledAt: "10:30", at: "10:30" });
  expect(run({ at: "15:00" }).curl).toContain(REACHED_LOCK);
  expect(run({ at: "15:01" }).curl).toContain(REACHED_LOCK);
});

test("sync_prod_to_staging.sh fails when it can't record the day", () => {
  mkdirSync(join(home, "sync_prod_to_staging.slot"));
  const result = run({ scheduledAt: "10:30", at: "10:30" });
  expect(result.exitCode).toBe(1);
  expect(result.curl).toContain("cannot write");
  expect(result.curl).toContain("http://hc.invalid/check/fail");
  expect(result.curl).not.toContain(REACHED_LOCK);
});

test("sync_prod_to_staging.sh fails when the clock isn't a number", () => {
  const result = run({ scheduledAt: "10:30", at: "10:30", fakeEpoch: "" });
  expect(result.exitCode).toBe(1);
  expect(result.curl).toContain("not a number");
  expect(result.curl).toContain("http://hc.invalid/check/fail");
  expect(result.curl).not.toContain(REACHED_LOCK);
});

test.each(["1030", "24:00", "9:30"])(
  "sync_prod_to_staging.sh fails on a malformed SYNC_SCHEDULED_AT of %s",
  (scheduledAt) => {
    const result = run({ scheduledAt, at: "10:30" });
    expect(result.exitCode).toBe(1);
    expect(result.curl).toContain("is not HH:MM");
    expect(result.curl).toContain("http://hc.invalid/check/fail");
  },
);

test("the service's SYNC_SCHEDULED_AT matches the timer's OnCalendar=", () => {
  const unit = (name: string) =>
    readFileSync(
      join(
        import.meta.dir,
        "../deploy/systemd",
        `alliance-prod-to-staging-sync.${name}`,
      ),
      "utf8",
    );
  const timer = unit("timer").match(
    /^OnCalendar=\*-\*-\* (\d\d:\d\d):00 UTC$/m,
  );
  const service = unit("service").match(
    /^Environment=SYNC_SCHEDULED_AT=(\S+)$/m,
  );
  expect(timer?.[1]).toBeDefined();
  expect(service?.[1]).toBe(timer?.[1]);
});
