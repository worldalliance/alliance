/**
 * Signs up 1000 Kora waitlist participants, +14155550000 to +14155550999,
 * who sign in with the code 000000 (see src/otp/test-phone.ts). Re-running
 * skips numbers already signed up. --delete removes every +1415555 participant.
 *
 *   (cd server && bun scripts/seed-kora-waitlist.ts [--delete])
 *   staging host: ~/secrets_run.sh bun scripts/seed-kora-waitlist.ts [--delete]
 */
import { NodeEnv } from "@alliance/common/node-env";
import { Like } from "typeorm";
import { env } from "../src/config/env";
import dataSource from "../src/datasources/dataSource";
import { KoraParticipant } from "../src/kora/entities/kora-participant.entity";
import { TEST_PHONE_PREFIX } from "../src/otp/test-phone";

const COUNT = 1000;

async function main() {
  if (env("NODE_ENV") === NodeEnv.Production) {
    throw new Error("Refusing to seed test participants in production.");
  }
  await dataSource.initialize();
  try {
    const participants = dataSource.getRepository(KoraParticipant);
    const testPhones = { phoneNumber: Like(`${TEST_PHONE_PREFIX}%`) };
    if (process.argv.includes("--delete")) {
      const { affected } = await participants.delete(testPhones);
      console.log(`Deleted ${affected ?? 0} test participants.`);
      return;
    }
    const now = new Date();
    const before = await participants.countBy(testPhones);
    await participants
      .createQueryBuilder()
      .insert()
      .values(
        Array.from({ length: COUNT }, (_, n) => {
          const suffix = String(n).padStart(4, "0");
          return {
            name: `Test participant ${suffix}`,
            phoneNumber: `${TEST_PHONE_PREFIX}${suffix}`,
            contactVerifiedAt: now,
          };
        }),
      )
      .orIgnore()
      .execute();
    console.log(
      `Signed up ${(await participants.countBy(testPhones)) - before} test participants; ${before} already existed.`,
    );
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
