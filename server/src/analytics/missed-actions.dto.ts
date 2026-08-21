import { ApiProperty } from "@nestjs/swagger";

export type MissedActionMember = {
  userId: number;
  name: string;
  lastActionName: string;
};

export type MissedActions = {
  missedLastAction: MissedActionMember[];
  missedLastTwoActions: MissedActionMember[];
};

export class MissedActionMemberDto {
  @ApiProperty()
  userId: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  lastActionName: string;

  constructor(input: MissedActionMember) {
    this.userId = input.userId;
    this.name = input.name;
    this.lastActionName = input.lastActionName;
  }
}

export class MissedActionsDto {
  @ApiProperty({ type: () => MissedActionMemberDto, isArray: true })
  missedLastAction: MissedActionMemberDto[];

  @ApiProperty({ type: () => MissedActionMemberDto, isArray: true })
  missedLastTwoActions: MissedActionMemberDto[];

  constructor(input: MissedActions) {
    this.missedLastAction = input.missedLastAction.map(
      (member) => new MissedActionMemberDto(member),
    );
    this.missedLastTwoActions = input.missedLastTwoActions.map(
      (member) => new MissedActionMemberDto(member),
    );
  }
}
