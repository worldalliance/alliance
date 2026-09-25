import type { CohortExpression } from "@alliance/common/cohort-expression";
import { millisecondsInDay } from "date-fns/constants";
import { ActionActivity } from "../src/actions/entities/action-activity.entity";
import { ActionCohortDecision } from "../src/actions/entities/action-cohort-decision.entity";
import {
  ActionEvent,
  ActionStatus,
} from "../src/actions/entities/action-event.entity";
import { Action, VisibilityMode } from "../src/actions/entities/action.entity";
import {
  ContractEvent,
  ContractEventType,
} from "../src/user/entities/contract-event.entity";
import { User } from "../src/user/entities/user.entity";
import type { TestContext } from "./e2e-test-utils";

export const addDays = (date: Date, days: number) =>
  new Date(date.getTime() + days * millisecondsInDay);

export type CohortDecisionFixtures = ReturnType<typeof cohortDecisionFixtures>;

export function cohortDecisionFixtures(ctx: TestContext) {
  const actionRepo = ctx.dataSource.getRepository(Action);
  const eventRepo = ctx.dataSource.getRepository(ActionEvent);
  const decisionRepo = ctx.dataSource.getRepository(ActionCohortDecision);
  const contractEventRepo = ctx.dataSource.getRepository(ContractEvent);
  const userRepo = ctx.dataSource.getRepository(User);
  const activityRepo = ctx.dataSource.getRepository(ActionActivity);

  let userCount = 0;
  const createUser = async (
    params: {
      signedAt?: Date;
      tagged?: boolean;
      timeZone?: string;
    } = {},
  ) => {
    const { signedAt, tagged = true, timeZone } = params;
    userCount++;
    const user = await userRepo.save(
      userRepo.create({
        email: `cohort-decision-${userCount}@example.com`,
        password: "pass",
        name: `Member ${userCount}`,
        tags: tagged ? [ctx.defaultTag] : [],
        timeZone,
      }),
    );
    if (signedAt) {
      await contractEventRepo.save({
        user: { id: user.id },
        type: ContractEventType.SIGNED,
        date: signedAt,
        contract: { id: ctx.defaultContractId },
      });
    }
    return user;
  };

  const createAction = async (params: {
    start: Date;
    deadline: Date | null;
    cohortExpression?: CohortExpression;
    onboarding?: boolean;
  }) => {
    const { start, deadline, onboarding = false } = params;
    const action = await actionRepo.save(
      actionRepo.create({
        name: "Action",
        category: [],
        body: "Body",
        shortDescription: "Short description",
        visibilityMode: VisibilityMode.Public,
        cohortExpression: params.cohortExpression ?? {
          type: "Tag",
          tagId: ctx.defaultTag.id,
        },
        onboarding,
      }),
    );
    await eventRepo.save([
      eventRepo.create({
        title: "Member action",
        description: "",
        newStatus: ActionStatus.MemberAction,
        date: start,
        action,
      }),
      ...(deadline
        ? [
            eventRepo.create({
              title: "Resolution",
              description: "",
              newStatus: ActionStatus.Resolution,
              date: deadline,
              action,
            }),
          ]
        : []),
    ]);
    return action;
  };

  const decisionsFor = async (actionId: number) =>
    new Map(
      (await decisionRepo.find({ where: { actionId } })).map((row) => [
        row.userId,
        row,
      ]),
    );

  const cleanUp = async () => {
    await decisionRepo.query("DELETE FROM action_cohort_decision");
    await activityRepo.query("DELETE FROM action_activity");
    await eventRepo.query("DELETE FROM action_event");
    await actionRepo.query("DELETE FROM action");
    await contractEventRepo.query("DELETE FROM contract_event");
    await userRepo.query(
      `DELETE FROM "user" WHERE id NOT IN (${ctx.testUserId}, ${ctx.adminUserId})`,
    );
  };

  return { createUser, createAction, decisionsFor, cleanUp };
}
