import { ApiProperty, ApiPropertyOptional, PickType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsOptional, ValidateNested } from "class-validator";
import { CreateActionEventDto } from "./action-event.dto";
import { ActionDto } from "./action.dto";
import { CreateReminderGroupDto } from "./reminder-group.dto";

export class CreateProjectActionDto extends PickType(ActionDto, [
  "name",
  "shortDescription",
]) {}

export class ScheduleReleaseDto {
  @ApiProperty({ type: () => CreateActionEventDto })
  @ValidateNested()
  @Type(() => CreateActionEventDto)
  launch: CreateActionEventDto;

  @ApiPropertyOptional({ type: () => CreateActionEventDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateActionEventDto)
  deadline?: CreateActionEventDto | null;

  @ApiProperty({ type: () => CreateReminderGroupDto, isArray: true })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateReminderGroupDto)
  reminders: CreateReminderGroupDto[];
}
