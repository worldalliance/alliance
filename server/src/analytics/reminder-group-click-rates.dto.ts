import { ApiProperty } from "@nestjs/swagger";

export type ReminderGroupClickRatePoint = {
  date: Date;
  reminderGroupId: number;
  reminderGroupName: string;
  actionId: number;
  actionName: string;
  emailClickRate: number;
  textClickRate: number;
  emailSentCount: number;
  emailClickedCount: number;
  textSentCount: number;
  textClickedCount: number;
};

export class ReminderGroupClickRatePointDto {
  @ApiProperty({ type: Date })
  date: Date;

  @ApiProperty()
  reminderGroupId: number;

  @ApiProperty()
  reminderGroupName: string;

  @ApiProperty()
  actionId: number;

  @ApiProperty()
  actionName: string;

  @ApiProperty()
  emailClickRate: number;

  @ApiProperty()
  textClickRate: number;

  @ApiProperty()
  emailSentCount: number;

  @ApiProperty()
  emailClickedCount: number;

  @ApiProperty()
  textSentCount: number;

  @ApiProperty()
  textClickedCount: number;

  constructor(input: ReminderGroupClickRatePoint) {
    this.date = input.date;
    this.reminderGroupId = input.reminderGroupId;
    this.reminderGroupName = input.reminderGroupName;
    this.actionId = input.actionId;
    this.actionName = input.actionName;
    this.emailClickRate = input.emailClickRate;
    this.textClickRate = input.textClickRate;
    this.emailSentCount = input.emailSentCount;
    this.emailClickedCount = input.emailClickedCount;
    this.textSentCount = input.textSentCount;
    this.textClickedCount = input.textClickedCount;
  }
}
