import { NestFactory } from "@nestjs/core";
import { getRepositoryToken } from "@nestjs/typeorm";
import assert from "node:assert/strict";
import "reflect-metadata";
import type { Repository } from "typeorm";
import {
  defaultMissedDeadlineEmailContents,
  defaultMissedDeadlineEmailSubject,
} from "../../apps/admin/src/components/reminders/defaultReminderContents";
import {
  ActionsService,
  type MissedActionReminderContext,
} from "../src/actions/actions.service";
import { Action } from "../src/actions/entities/action.entity";
import { AppModule } from "../src/app.module";
import { processKeywordReplacements } from "../src/mail/mail.service";
import { User } from "../src/user/entities/user.entity";

enum EmailVariant {
  FirstAction = "first_action",
  ReturningMember = "returning_member",
  RepeatMiss = "repeat_miss",
}

const expectedFragments: Record<EmailVariant, string[]> = {
  [EmailVariant.FirstAction]: [
    "The Alliance counts on every member.",
    "To learn more about our model",
    "if you miss several actions in a row",
  ],
  [EmailVariant.ReturningMember]: [
    "Remember that we plan each action around the number of members we expect to participate.",
  ],
  [EmailVariant.RepeatMiss]: [
    "Remember that we plan each action around the number of members we expect to participate.",
    "If you miss all of your assigned non-optional actions again next week, your contract will be suspended automatically.",
  ],
};

const forbiddenFragments: Record<EmailVariant, string[]> = {
  [EmailVariant.FirstAction]: ["again next week"],
  [EmailVariant.ReturningMember]: [
    "The Alliance counts on every member.",
    "again next week",
  ],
  [EmailVariant.RepeatMiss]: [
    "second week",
    "third week",
    "sign the contract again",
  ],
};

function variantForContext(
  context: MissedActionReminderContext,
): EmailVariant | null {
  if (context.isFirstAssignedSuite) {
    return EmailVariant.FirstAction;
  }
  if (context.consecutiveMissedSuiteCount === 2) {
    return EmailVariant.RepeatMiss;
  }
  return EmailVariant.ReturningMember;
}

function renderEmail(context: MissedActionReminderContext): string {
  const user = new User();
  user.name = "Test Member";

  const action = new Action();
  action.name = "Test action";

  return processKeywordReplacements(defaultMissedDeadlineEmailContents, {
    user,
    action,
    cid: "local-email-test",
    uncompletedTasksCount: 1,
    uncompletedTasksTime: "15 minutes",
    uncompletedTasksNames: ["Test action"],
    isFirstAssignedSuite: context.isFirstAssignedSuite,
    consecutiveMissedSuiteCount: context.consecutiveMissedSuiteCount,
  });
}

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });

  try {
    const actionsService = app.get(ActionsService);
    const userRepository = app.get<Repository<User>>(getRepositoryToken(User));
    const users = await userRepository.find({ select: { id: true } });
    const contexts = await actionsService.getMissedActionReminderContexts(
      users.map((user) => user.id),
      new Date(),
    );

    const matches = new Map<EmailVariant, MissedActionReminderContext>();
    const counts = new Map<EmailVariant, number>();
    const historyCounts = new Map<string, number>();
    for (const context of contexts.values()) {
      const historyKey = `${context.isFirstAssignedSuite ? "first" : "returning"}:streak-${context.consecutiveMissedSuiteCount}`;
      historyCounts.set(historyKey, (historyCounts.get(historyKey) ?? 0) + 1);
      const variant = variantForContext(context);
      if (!variant) {
        continue;
      }
      counts.set(variant, (counts.get(variant) ?? 0) + 1);
      if (!matches.has(variant)) {
        matches.set(variant, context);
      }
    }

    assert.equal(
      defaultMissedDeadlineEmailSubject,
      "You missed an Alliance task",
    );
    console.table(
      [...historyCounts.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([history, count]) => ({ history, count })),
    );

    for (const variant of Object.values(EmailVariant)) {
      const context = matches.get(variant);
      assert.ok(
        context,
        `Local database has no real member history for ${variant}`,
      );
      const email = renderEmail(context);
      for (const fragment of expectedFragments[variant]) {
        assert.ok(
          email.includes(fragment),
          `${variant} is missing: ${fragment}`,
        );
      }
      for (const fragment of forbiddenFragments[variant]) {
        assert.ok(
          !email.includes(fragment),
          `${variant} unexpectedly contains: ${fragment}`,
        );
      }
      assert.ok(!email.includes("\n\n\n"), `${variant} has extra blank lines`);

      console.log(
        `\n=== ${variant} (${counts.get(variant)} database matches) ===`,
      );
      console.log(`Subject: ${defaultMissedDeadlineEmailSubject}\n`);
      console.log(email);
    }

    console.log("\nAll database-backed missed-action email checks passed.");
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
