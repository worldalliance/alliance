import { RecognitionGroup } from "@alliance/common/action-update-copy";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString } from "class-validator";
import type { RecognitionPreviewCounts } from "../action-update-recognition";
import {
  type ActionUpdate,
  ActionUpdateNotificationMode,
  ActionUpdateNotifyType,
} from "../entities/action-update.entity";
import { ActionUpdateDto } from "./action.dto";

export class AdminActionUpdateDto extends ActionUpdateDto {
  @ApiProperty({
    enum: ActionUpdateNotificationMode,
    enumName: "ActionUpdateNotificationMode",
  })
  notificationMode: ActionUpdateNotificationMode;

  @ApiProperty()
  splitCollectiveResult: boolean;

  @ApiProperty({ type: String, nullable: true })
  nonCompleterResult: string | null;

  @ApiProperty({ type: String, nullable: true })
  uninvolvedResult: string | null;

  @ApiProperty({ type: Date, nullable: true })
  recognitionPreparedAt: Date | null;

  @ApiProperty({ type: String, nullable: true })
  notificationHeldReason: string | null;

  constructor(input: ActionUpdate) {
    super(input);
    this.notificationMode = input.notificationMode;
    this.splitCollectiveResult = input.splitCollectiveResult;
    this.nonCompleterResult = input.nonCompleterResult;
    this.uninvolvedResult = input.uninvolvedResult;
    this.recognitionPreparedAt = input.recognitionPreparedAt;
    this.notificationHeldReason = input.notificationHeldReason;
  }
}

/** An audience the editor may not have saved yet. */
export class RecognitionPreviewAudienceDto {
  @ApiProperty({
    enum: ActionUpdateNotifyType,
    enumName: "ActionUpdateNotifyType",
  })
  @IsEnum(ActionUpdateNotifyType)
  notifyType: ActionUpdateNotifyType;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  tagId?: string | null;
}

export class RecognitionPreviewCountsDto {
  @ApiProperty()
  completed: number;

  @ApiProperty()
  didNotComplete: number;

  @ApiProperty()
  uninvolved: number;

  constructor(input: RecognitionPreviewCounts) {
    this.completed = input[RecognitionGroup.Completed];
    this.didNotComplete = input[RecognitionGroup.DidNotComplete];
    this.uninvolved = input[RecognitionGroup.Uninvolved];
  }
}
