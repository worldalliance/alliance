import { isEmail } from "class-validator";
import { DataSource, type EntityManager } from "typeorm";
import { connectionOptions } from "../src/datasources/dataSource";

const usage = "usage: bun scripts/change-user-email.ts <oldEmail> <newEmail>";

type UserRow = { id: number; email: string; emailVerified: boolean };

function describe(rows: UserRow[]): string {
  return rows.map((row) => `#${row.id} <${row.email}>`).join(", ");
}

async function changeEmail(
  manager: EntityManager,
  oldEmail: string,
  newEmail: string,
): Promise<UserRow> {
  // Sign-in resolves the address case-insensitively (UserService.findByEmail),
  // so rows differing only by case are all candidates for the address given.
  const matches: UserRow[] = await manager.query(
    `SELECT id, email, "emailVerified" FROM "user" WHERE lower(email) = lower($1) FOR UPDATE`,
    [oldEmail],
  );

  if (matches.length === 0) {
    throw new Error(`No account with email ${oldEmail}.`);
  }
  if (matches.length > 1) {
    throw new Error(
      `${matches.length} accounts with email ${oldEmail}: ${describe(matches)}. Resolve by hand.`,
    );
  }

  const [user] = matches;
  const taken: UserRow[] = await manager.query(
    `SELECT id, email FROM "user" WHERE lower(email) = lower($1) AND id <> $2`,
    [newEmail, user.id],
  );
  if (taken.length > 0) {
    throw new Error(`${newEmail} already belongs to ${describe(taken)}.`);
  }

  await manager.query(
    `UPDATE "user" SET email = $1, "emailVerified" = true WHERE id = $2`,
    [newEmail, user.id],
  );

  return user;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length !== 2) {
    throw new Error(usage);
  }

  const [oldEmail, newEmail] = args;
  for (const email of [oldEmail, newEmail]) {
    if (!isEmail(email)) {
      throw new Error(`Not a valid email address: ${email}\n${usage}`);
    }
  }

  const dataSource = new DataSource(connectionOptions());
  await dataSource.initialize();
  try {
    const user = await dataSource.transaction((manager) =>
      changeEmail(manager, oldEmail, newEmail),
    );
    console.log(`#${user.id}: ${user.email} -> ${newEmail}, marked verified.`);
    console.log(
      "They must sign out and back in: their current token carries the old address, which the admin and community-leader guards look up by.",
    );
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
