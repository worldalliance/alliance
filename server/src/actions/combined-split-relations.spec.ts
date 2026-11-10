import { describe, expect, it } from "bun:test";
import {
  UserActionRelationPillStatus,
  type UserActionRelations,
} from "src/user/dto/user-action-relations.dto";
import { collapseCombinedArms } from "./combined-split-relations";
import { ActionStatus } from "./entities/action-event.entity";

const summary = (id: number, name: string) => ({
  id,
  name,
  status: ActionStatus.MemberAction,
  weekNumber: null,
  allMembersParticipating: false,
  memberActionDeadline: null,
});

describe("collapseCombinedArms", () => {
  it("shows a combined split once, with each member's arm relation under it", () => {
    const relations: UserActionRelations = {
      actions: [summary(1, "Other"), summary(2, "Arm A"), summary(3, "Arm B")],
      suites: [],
      users: [
        {
          userId: 10,
          relations: [
            { actionId: 1, status: UserActionRelationPillStatus.Completed },
            { actionId: 2, status: UserActionRelationPillStatus.NotRequired },
            { actionId: 3, status: UserActionRelationPillStatus.Completed },
          ],
        },
      ],
    };
    const result = collapseCombinedArms({
      relations,
      splitOfArm: new Map([
        [2, { id: 9, title: "Split" }],
        [3, { id: 9, title: "Split" }],
      ]),
    });
    expect(result.actions.map(({ id, name }) => [id, name])).toEqual([
      [1, "Other"],
      [2, "Split"],
    ]);
    expect(result.users[0].relations).toEqual([
      { actionId: 1, status: UserActionRelationPillStatus.Completed },
      { actionId: 2, status: UserActionRelationPillStatus.Completed },
    ]);
  });
});
