import { ApiProperty, PickType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsDefined } from "class-validator";
import { ProfileDto } from "src/user/dto/user.dto";
import { User } from "src/user/entities/user.entity";
import { Action } from "../entities/action.entity";

export type SuspensionPlan = { date: Date; users: User[] };

export class SuspensionPlanDto {
  @ApiProperty({ type: Date })
  @IsDefined()
  @Type(() => Date)
  date: Date;

  @ApiProperty({ type: () => ProfileDto, isArray: true })
  @Type(() => ProfileDto)
  @IsDefined()
  users: ProfileDto[];

  constructor(input: SuspensionPlan) {
    this.date = input.date;
    this.users = input.users.map((user) => new ProfileDto(user));
  }
}

export class ActionSummaryDto extends PickType(Action, ["id", "name"]) {
  constructor(action: Pick<Action, "id" | "name">) {
    super();
    this.id = action.id;
    this.name = action.name;
  }
}

export type ForumAutocompletePlan = SuspensionPlan & {
  action: Action;
};

export class ForumAutocompletePlanDto extends SuspensionPlanDto {
  @ApiProperty({ type: () => ActionSummaryDto })
  @Type(() => ActionSummaryDto)
  @IsDefined()
  action: ActionSummaryDto;

  constructor(input: ForumAutocompletePlan) {
    super({ date: input.date, users: input.users });
    this.action = new ActionSummaryDto(input.action);
  }
}

export class ScheduledPlansOverviewDto {
  @ApiProperty({ type: () => SuspensionPlanDto, isArray: true })
  @Type(() => SuspensionPlanDto)
  @IsDefined()
  suspensionPlans: SuspensionPlanDto[];

  @ApiProperty({ type: () => ForumAutocompletePlanDto, isArray: true })
  @Type(() => ForumAutocompletePlanDto)
  @IsDefined()
  forumAutocompletePlans: ForumAutocompletePlanDto[];

  constructor(input: {
    suspensionPlans: SuspensionPlan[];
    forumAutocompletePlans: ForumAutocompletePlan[];
  }) {
    this.suspensionPlans = input.suspensionPlans.map(
      (plan) => new SuspensionPlanDto(plan),
    );
    this.forumAutocompletePlans = input.forumAutocompletePlans.map(
      (plan) => new ForumAutocompletePlanDto(plan),
    );
  }
}
