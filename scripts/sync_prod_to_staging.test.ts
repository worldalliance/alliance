import { afterEach, beforeEach, expect, test } from "bun:test";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SOURCE = join(import.meta.dir, "sync_prod_to_staging.sh");

const SECRETS: Record<string, string> = {
  SLACK_WEBHOOK_URL: "http://slack.invalid",
  HEALTHCHECK_URL: "http://hc.invalid/check",
  PROD_DB_HOST: "prod.invalid",
  PROD_DB_USER: "reader",
  PROD_DB_PASSWORD: "prod-secret",
  PROD_ASSETS_BUCKET: "prod-bucket",
  STAGING_PASSWORD_HASH: `$2b$10$${"a".repeat(53)}`,
  DB_HOST: "staging.invalid",
  DB_USERNAME: "admin",
  DB_PASSWORD: "staging-secret",
  ASSETS_BUCKET: "staging-bucket",
};

const PG_TOOL = `
  echo "$(basename "$0") $* | $PGHOST $PGUSER $PGPASSWORD $PGDATABASE | $PGSSLMODE $PGSSLROOTCERT" >> "$STATE/pg"
  [ "$(basename "$0")" != "\${PG_FAILS:-}" ]`;

const HELD_LOCK = `
  held=$(readlink "/proc/$PPID/fd/201" 2>/dev/null \\
    || lsof -a -p "$PPID" -d 201 -Fn 2>/dev/null | sed -n 's/^n//p')`;

// Unless FLOCK_OK is set, flock exits 1, so a run the guard lets through stops
// at the lock and posts "another sync is already running". FLOCK_FAILS names
// the one flock call that still fails.
const STUBS: Record<string, string> = {
  curl: `echo "$*" >> "$STATE/curl-argv"; { echo "$*"; cat; } >> "$STATE/curl"`,
  cp: `${HELD_LOCK}
    echo "cp $*\${held:+ under \${held##*/}}" >> "$STATE/calls"
    PATH="\${PATH#*:}" exec cp "$@"`,
  date: `
    if [ "$*" = "-u +%s" ]; then echo "$FAKE_EPOCH"; else PATH="\${PATH#*:}" exec date "$@"; fi`,
  flock: `
    echo "flock $*" >> "$STATE/calls"
    [ -n "\${FLOCK_OK:-}" ] && [ "$*" != "\${FLOCK_FAILS:-}" ]`,
  aws: `echo "aws $*" >> "$STATE/aws"`,
  pg_dump: PG_TOOL,
  pg_restore: PG_TOOL,
  psql: `cat >> "$STATE/psql-stdin"; ${PG_TOOL}`,
  env: `echo "$*" >> "$STATE/env"; exec /usr/bin/env "$@"`,
  "secrets_run.sh": `
    echo "$*" >> "$STATE/secrets_run"
    while [ "$1" != -- ]; do shift; done
    shift
    while IFS='=' read -r -d '' name value; do
      export "$name=$value"
    done < "$STATE/secrets"
    exec "$@"`,
  ".bun/bin/bun": `${HELD_LOCK}
    echo "bun $*\${held:+ under \${held##*/}}" >> "$STATE/calls"
    [ -z "\${BUN_FAILS:-}" ] || exit 1
    [ "$2" = "\${BUN_EMPTY:-}" ] || echo "\${2}_db"`,
  ".bun/bin/bunx": `
    echo "bunx $* | $DB_HOST $DB_NAME $DB_USERNAME $DB_PASSWORD" >> "$STATE/pg"
    env > "$STATE/bunx-env"`,
};

const ANONYMIZE = "nest-backend/scripts/anonymize";
const RDS_BUNDLE = "nest-backend/server/src/config/rds-us-west-2-bundle.pem";

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
  chmodSync(script, 0o755);
  writeSecrets();
  mkdirSync(join(home, ".bun/bin"), { recursive: true });
  mkdirSync(join(home, "nest-backend/server/src/config"), { recursive: true });
  writeFileSync(join(home, RDS_BUNDLE), "-- bundle\n");
  mkdirSync(join(home, ANONYMIZE), { recursive: true });
  writeFileSync(join(home, ANONYMIZE, "anonymize.sql"), "-- anonymize\n");
  for (const [name, body] of Object.entries(STUBS)) {
    const path =
      name.includes("/") || name.endsWith(".sh")
        ? join(home, name)
        : join(bin, name);
    writeFileSync(path, `#!/usr/bin/env bash\n${body}\n`);
    chmodSync(path, 0o755);
  }
});

function writeSecrets(overrides: Record<string, string> = {}) {
  writeFileSync(
    join(state, "secrets"),
    Object.entries({ ...SECRETS, ...overrides })
      .map(([name, value]) => `${name}=${value}\0`)
      .join(""),
  );
}

afterEach(() => {
  rmSync(home, { recursive: true });
});

const DAY = 1440;

const epochDay = (day = 0) => 20_000 + day;

function epochMinute(params: { day?: number; at: string }) {
  const [hours, minutes] = params.at.split(":").map(Number);
  return epochDay(params.day) * DAY + hours * 60 + minutes;
}

const readState = (name: string) => {
  try {
    return readFileSync(join(state, name), "utf8");
  } catch {
    return "";
  }
};

function run(params: {
  scheduledAt?: string;
  day?: number;
  at: string;
  fakeEpoch?: string;
  env?: Record<string, string>;
}) {
  const env: Record<string, string> = {
    PATH: `${bin}:${process.env.PATH}`,
    STATE: state,
    FAKE_EPOCH: params.fakeEpoch ?? String(epochMinute(params) * 60 + 17),
    ...params.env,
  };
  if (params.scheduledAt !== undefined) {
    env.SYNC_SCHEDULED_AT = params.scheduledAt;
  }
  const result = Bun.spawnSync(["bash", script], { stdin: "ignore", env });
  const curl = readState("curl");
  rmSync(join(state, "curl"), { force: true });
  return { exitCode: result.exitCode, curl, stderr: result.stderr.toString() };
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

test("sync_prod_to_staging.sh loads its secrets once, through the wrapper", () => {
  run({ at: "15:00" });
  expect(readState("secrets_run")).toBe(
    "--path /alliance/staging/db-sync/ SLACK_WEBHOOK_URL HEALTHCHECK_URL " +
      "PROD_DB_HOST PROD_DB_USER PROD_DB_PASSWORD PROD_ASSETS_BUCKET " +
      "STAGING_PASSWORD_HASH --path /alliance/staging/server/ " +
      `DB_HOST DB_USERNAME DB_PASSWORD ASSETS_BUCKET -- env SYNC_SECRETS_LOADED=1 bash ${script}\n`,
  );
});

test.each([
  ["SLACK_WEBHOOK_URL", 'http://slack.invalid/a"b'],
  ["HEALTHCHECK_URL", "http://hc.invalid/check\nwrite-out = x"],
  ["SLACK_WEBHOOK_URL", "http://slack.invalid/a\\"],
])(
  "sync_prod_to_staging.sh refuses a %s curl's config would misread",
  (key, url) => {
    writeSecrets({ [key]: url });
    const result = run({ at: "15:00", env: { FLOCK_OK: "1" } });
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(`${key} is not an http(s) URL`);
    expect(readState("curl-argv")).toBe("");
  },
);

test("sync_prod_to_staging.sh refuses a STAGING_PASSWORD_HASH that isn't bcrypt before psql sees it", () => {
  writeSecrets({ STAGING_PASSWORD_HASH: "x' \\! touch PWNED \\echo '" });
  const result = run({ at: "15:00", env: { FLOCK_OK: "1" } });
  expect(result.exitCode).toBe(1);
  expect(result.stderr).toContain(
    "STAGING_PASSWORD_HASH is not a bcrypt hash.",
  );
  expect(readState("psql-stdin")).toBe("");
  expect(readState("pg")).toBe("");
});

test("sync_prod_to_staging.sh copies prod to staging with the logins kept out of argv", () => {
  const result = run({ at: "15:00", env: { FLOCK_OK: "1" } });
  expect(result.exitCode).toBe(0);
  expect(result.curl).toContain("Sync completed successfully.");
  expect(result.curl).toEndWith('url = "http://hc.invalid/check"\n');
  const pg = readState("pg");
  const steps = pg.split("\n").filter(Boolean);
  expect(steps.map((line) => line.split(" ")[0])).toEqual([
    "pg_dump",
    "psql",
    "pg_restore",
    "psql",
    "bunx",
    "psql",
  ]);
  const login = (line: string) => line.split(" | ")[1];
  expect(login(steps[0])).toBe("prod.invalid reader prod-secret production_db");
  expect(login(steps[1])).toBe("staging.invalid admin staging-secret postgres");
  expect(steps[2]).toContain("--dbname=staging_db_sync");
  expect(login(steps[2])).toBe(
    "staging.invalid admin staging-secret staging_db_sync",
  );
  expect(login(steps[3])).toBe(
    "staging.invalid admin staging-secret staging_db_sync",
  );
  expect(steps[4]).toEndWith(
    "| staging.invalid staging_db_sync admin staging-secret",
  );
  expect(login(steps[5])).toBe("staging.invalid admin staging-secret postgres");
  const tls = `verify-full ${home}/sync_prod_to_staging.files/rds-us-west-2-bundle.pem`;
  for (const line of steps.filter((step) => !step.startsWith("bunx"))) {
    expect(line).toEndWith(`| ${tls}`);
  }
  for (const line of steps) {
    const argv = line.split(" | ")[0];
    expect(argv).not.toContain("secret");
    expect(argv).not.toContain(SECRETS.STAGING_PASSWORD_HASH);
  }
  expect(readState("psql-stdin")).toContain(
    `\\set password_hash '${SECRETS.STAGING_PASSWORD_HASH}'\n` +
      `\\set in_anonymize_dir\n\\cd '${home}/sync_prod_to_staging.files/anonymize'\n\\i anonymize.sql\n`,
  );
  const curlArgv = readState("curl-argv");
  expect(curlArgv).toContain("--config -");
  expect(curlArgv).not.toContain("slack.invalid");
  expect(curlArgv).not.toContain("hc.invalid");
  expect(result.curl).toContain('url = "http://slack.invalid"');
  expect(readState("env")).not.toContain("secret");
  const migrationEnv = readState("bunx-env");
  expect(migrationEnv).toContain("DB_PASSWORD=staging-secret");
  const passedLogin = ["DB_HOST", "DB_USERNAME", "DB_PASSWORD"];
  for (const [name, value] of Object.entries(SECRETS)) {
    if (!passedLogin.includes(name)) expect(migrationEnv).not.toContain(value);
  }
  expect(readState("aws")).toContain("s3://prod-bucket/ s3://staging-bucket/");
});

test("sync_prod_to_staging.sh drops the scratch database when a step before the swap fails", () => {
  const result = run({
    at: "15:00",
    env: { FLOCK_OK: "1", PG_FAILS: "pg_restore" },
  });
  expect(result.exitCode).toBe(1);
  expect(result.curl).toContain("FAILED during restore");
  const steps = readState("pg").split("\n").filter(Boolean);
  expect(steps.at(-1)).toBe(
    `psql -q -c DROP DATABASE IF EXISTS staging_db_sync WITH (FORCE); | staging.invalid admin staging-secret postgres | verify-full ${home}/sync_prod_to_staging.files/rds-us-west-2-bundle.pem`,
  );
});

test("sync_prod_to_staging.sh reads its database names and copies the files it needs later under ~/migrate.lock", () => {
  run({ at: "15:00", env: { FLOCK_OK: "1" } });
  const helper = join(home, "nest-backend/scripts/deployed-db-name.ts");
  expect(readState("calls")).toStartWith(
    `flock -n 200\nflock -w 900 201\nbun ${helper} production under migrate.lock\nbun ${helper} staging under migrate.lock\n` +
      `cp -R ${join(home, ANONYMIZE)} ${join(home, RDS_BUNDLE)} ${home}/sync_prod_to_staging.files/ under migrate.lock\n`,
  );
});

test.each([
  ["scripts/anonymize", ANONYMIZE],
  ["the RDS bundle", RDS_BUNDLE],
])(
  "sync_prod_to_staging.sh reports %s missing from ~/nest-backend",
  (_, path) => {
    rmSync(join(home, path), { recursive: true });
    const result = run({ at: "15:00", env: { FLOCK_OK: "1" } });
    expect(result.exitCode).toBe(1);
    expect(result.curl).toContain(
      "could not copy scripts/anonymize and the RDS certificate bundle",
    );
    expect(result.curl).toContain("http://hc.invalid/check/fail");
    expect(readState("pg")).toBe("");
  },
);

test("the anonymize scripts read only files beside them, which the sync copies with them", () => {
  const dir = join(import.meta.dir, "anonymize");
  const sql = readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .map((name) => readFileSync(join(dir, name), "utf8"))
    .join("\n");
  const reads = [
    ...sql.matchAll(/^\\(?:ir?\s+|copy\s.*\sFROM\s+)'?([^'\s]+)/gim),
  ].map((match) => match[1]);
  expect(reads).toContain("scrub_contacts.sql");
  expect(reads).toContain("first_names.txt");
  for (const file of reads) {
    expect(file).not.toContain("/");
    expect(existsSync(join(dir, file))).toBe(true);
  }
});

test.each([
  ["it can't read", { BUN_FAILS: "1" }],
  ["that are empty", { BUN_EMPTY: "staging" }],
])("sync_prod_to_staging.sh reports database names %s", (_, failure) => {
  const result = run({ at: "15:00", env: { FLOCK_OK: "1", ...failure } });
  expect(result.exitCode).toBe(1);
  expect(result.curl).toContain("deployed-db-name.ts");
  expect(result.curl).toContain("http://hc.invalid/check/fail");
  expect(readState("pg")).toBe("");
});

test("sync_prod_to_staging.sh reports a deploy that holds ~/migrate.lock", () => {
  const result = run({
    at: "15:00",
    env: { FLOCK_OK: "1", FLOCK_FAILS: "-w 900 201" },
  });
  expect(result.exitCode).toBe(1);
  expect(result.curl).toContain("held ~/migrate.lock for 15 minutes");
  expect(result.curl).toContain("http://hc.invalid/check/fail");
});

test("sync_prod_to_staging.sh reports a ~/migrate.lock it can't open", () => {
  mkdirSync(join(home, "migrate.lock"));
  const result = run({ at: "15:00", env: { FLOCK_OK: "1" } });
  expect(result.exitCode).toBe(1);
  expect(result.curl).toContain("cannot write ~/migrate.lock");
  expect(result.curl).toContain("http://hc.invalid/check/fail");
});
