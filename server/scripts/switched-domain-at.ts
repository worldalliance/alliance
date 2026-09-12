import { isEmail } from "class-validator";
import { DataSource, type EntityManager } from "typeorm";
import { connectionOptions } from "../src/datasources/dataSource";

const usage =
  "usage: bun scripts/switched-domain-at.ts <email> [--now | --clear]";

type UserRow = { id: number; email: string; switchedDomainAt: Date | null };

function describe(rows: UserRow[]): string {
  return rows.map((row) => `#${row.id} <${row.email}>`).join(", ");
}

function format(value: Date | null): string {
  return value === null ? "null" : value.toISOString();
}

async function findUser(
  manager: EntityManager,
  email: string,
): Promise<UserRow> {
  // Sign-in resolves the address case-insensitively (UserService.findByEmail),
  // so rows differing only by case are all candidates for the address given.
  const matches: UserRow[] = await manager.query(
    `SELECT id, email, "switchedDomainAt" FROM "user" WHERE lower(email) = lower($1) FOR UPDATE`,
    [email],
  );

  if (matches.length === 0) {
    throw new Error(`No account with email ${email}.`);
  }
  if (matches.length > 1) {
    throw new Error(
      `${matches.length} accounts with email ${email}: ${describe(matches)}. Resolve by hand.`,
    );
  }

  return matches[0];
}

async function main(): Promise<void> {
  const [email, flag, ...rest] = process.argv.slice(2);

  if (!email || rest.length > 0) {
    throw new Error(usage);
  }
  if (!isEmail(email)) {
    throw new Error(`Not a valid email address: ${email}\n${usage}`);
  }
  if (flag !== undefined && flag !== "--now" && flag !== "--clear") {
    throw new Error(`Unknown option: ${flag}\n${usage}`);
  }

  const dataSource = new DataSource(connectionOptions());
  await dataSource.initialize();
  try {
    await dataSource.transaction(async (manager) => {
      const user = await findUser(manager, email);
      console.log(
        `#${user.id} <${user.email}>: switchedDomainAt = ${format(user.switchedDomainAt)}`,
      );

      if (flag === undefined) return;

      const next = flag === "--now" ? new Date() : null;
      await manager.query(
        `UPDATE "user" SET "switchedDomainAt" = $1 WHERE id = $2`,
        [next, user.id],
      );
      console.log(`Set switchedDomainAt = ${format(next)}.`);
    });
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
