import { RecognitionGroup } from "@alliance/common/action-update-copy";
import {
  ApiHideProperty,
  ApiProperty,
  ApiPropertyOptional,
} from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString } from "class-validator";
import type { RecognitionPreviewCounts } from "../action-update-recognition";
import {
  type ActionUpdate,
  ActionUpdateNotificationMode,
  ActionUpdateNotifyType,
} from "../entities/action-update.entity";
import { ActionUpdateDto } from "./action-update.dto";

export class AdminActionUpdateDto extends ActionUpdateDto {
  @ApiProperty({
    enum: ActionUpdateNotificationMode,
    enumName: "ActionUpdateNotificationMode",
  })
  notificationMode: ActionUpdateNotificationMode;

  // BACKCOMPAT(split-collective-result): an admin bundle from before the
  // result always split seeds its edit form from these two. Without the flag
  // it shows the update unsplit and saves with no flag for the input guard to
  // refuse; without `uninvolvedResult` it shows uninvolved members getting
  // nothing. Drop with that guard.
  @ApiHideProperty()
  splitCollectiveResult: boolean;

  /**
   * `nonCompleterResult`, what recognition updates send uninvolved members;
   * the stored column isn't read.
   */
  @ApiHideProperty()
  uninvolvedResult: string | null;

  @ApiProperty({ type: String, nullable: true })
  nonCompleterResult: string | null;

  @ApiProperty({ type: Date, nullable: true })
  recognitionPreparedAt: Date | null;

  @ApiProperty({ type: String, nullable: true })
  notificationHeldReason: string | null;

  constructor(input: ActionUpdate) {
    super(input);
    this.notificationMode = input.notificationMode;
    this.splitCollectiveResult = input.splitCollectiveResult;
    this.nonCompleterResult = input.nonCompleterResult;
    this.uninvolvedResult = input.nonCompleterResult;
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
