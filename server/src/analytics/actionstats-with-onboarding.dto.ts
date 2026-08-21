import { ApiProperty, PickType } from "@nestjs/swagger";
import { ActionStatsRecord } from "./actionstats.entity";

export type ActionStatsWithOnboarding = {
  actionStatsRecord: ActionStatsRecord;
  onboarding: boolean;
  optional: boolean;
};

export class ActionStatsWithOnboardingDto extends PickType(ActionStatsRecord, [
  "id",
  "actionId",
  "actionName",
  "usersCompleted",
  "usersJoined",
  "usersWithdrawn",
  "usersDismissed",
  "completionRate",
  "lastCalculatedAt",
  "actionCompletedAt",
  "showInChart",
  "memberActionStartDate",
  "memberActionEndDate",
]) {
  @ApiProperty({
    description: "Whether the action is marked as onboarding.",
  })
  onboarding: boolean;

  @ApiProperty({
    description: "Whether the action is optional.",
  })
  optional: boolean;

  constructor(input: ActionStatsWithOnboarding) {
    super();
    this.id = input.actionStatsRecord.id;
    this.actionId = input.actionStatsRecord.actionId;
    this.actionName = input.actionStatsRecord.actionName;
    this.usersCompleted = input.actionStatsRecord.usersCompleted;
    this.usersJoined = input.actionStatsRecord.usersJoined;
    this.usersWithdrawn = input.actionStatsRecord.usersWithdrawn;
    this.usersDismissed = input.actionStatsRecord.usersDismissed;
    this.completionRate = input.actionStatsRecord.completionRate;
    this.lastCalculatedAt = input.actionStatsRecord.lastCalculatedAt;
    this.actionCompletedAt = input.actionStatsRecord.actionCompletedAt;
    this.showInChart = input.actionStatsRecord.showInChart;
    this.memberActionStartDate = input.actionStatsRecord.memberActionStartDate;
    this.memberActionEndDate = input.actionStatsRecord.memberActionEndDate;
    this.onboarding = input.onboarding;
    this.optional = input.optional;
  }
}
