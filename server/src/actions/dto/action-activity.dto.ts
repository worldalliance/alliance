import type { VisibilityValidatorResults } from "@alliance/common/forms/visibility";
import { byLikeOrder, LIKE_FACEPILE_LIMIT } from "@alliance/common/likeOrder";
import { ApiProperty, ApiPropertyOptional, PickType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  Allow,
  IsBoolean,
  IsDefined,
  IsNumber,
  IsOptional,
  IsString,
} from "class-validator";
import { CommentDto } from "src/forum/dto/comment.dto";
import { EditableContentDto } from "src/forum/dto/editablecontent.dto";
import type { Comment } from "src/forum/entities/comment.entity";
import {
  FormResponse,
  loadedFormResponseSnapshot,
  type ParsedFormResponse,
} from "src/tasks/entities/formresponse.entity";
import { memberSnapshotSchema } from "src/tasks/form-snapshot-schema";
import { SubmitFormDto } from "src/tasks/form.dto";
import { ProfileDto } from "src/user/dto/user.dto";
import { User } from "src/user/entities/user.entity";
import {
  ActionActivity,
  loadedActionActivityAction,
  loadedActionActivityUser,
} from "../entities/action-activity.entity";

export class OptOutActionDto {
  @ApiProperty({ type: Number })
  @IsDefined()
  @IsNumber()
  actionId: number;

  @ApiProperty()
  @IsString()
  reason: string;

  @ApiProperty()
  @IsBoolean()
  outOfTime: boolean;

  @ApiProperty()
  @IsDefined()
  @IsBoolean()
  isMoral: boolean;

  @ApiPropertyOptional({ type: Object })
  @Type(() => Object)
  @IsOptional()
  partialFormData?: SubmitFormDto;
}

export class FormResponseOutputDto extends PickType(FormResponse, [
  "id",
  "answers",
  "formId",
  "deviceType",
  "publicAnswers",
]) {
  @ApiProperty()
  @Type(() => Object)
  schemaSnapshot: Record<string, unknown>;

  @ApiProperty({ type: Object })
  visibilityValidatorResults: VisibilityValidatorResults;

  constructor(formResponse: ParsedFormResponse) {
    super();
    this.id = formResponse.id;
    this.answers = formResponse.answers;
    this.formId = formResponse.formId;
    this.visibilityValidatorResults = formResponse.visibilityValidatorResults;
    this.deviceType = formResponse.deviceType;
    this.publicAnswers = formResponse.publicAnswers;
    this.schemaSnapshot = memberSnapshotSchema(
      loadedFormResponseSnapshot(formResponse),
      formResponse.assignedRow,
    );
  }
}

export class ActionActivityDto extends PickType(ActionActivity, [
  "id",
  "type",
  "createdAt",
  "actionId",
  "likesCount",
]) {
  @ApiProperty({ type: () => ProfileDto })
  @Type(() => ProfileDto)
  @Allow()
  user: ProfileDto;

  @ApiProperty()
  @Allow()
  actionName: string;

  @ApiPropertyOptional({ type: () => ProfileDto, isArray: true })
  @Type(() => ProfileDto)
  @IsOptional()
  likes?: ProfileDto[];

  @ApiPropertyOptional()
  @IsOptional()
  likedByMe?: boolean;

  @ApiProperty({ type: () => CommentDto, isArray: true })
  @Type(() => CommentDto)
  @Allow()
  comments: CommentDto[];

  @ApiPropertyOptional({ type: () => FormResponseOutputDto })
  @Type(() => FormResponseOutputDto)
  @IsOptional()
  formResponseOutput?: FormResponseOutputDto;

  @ApiProperty({ type: () => EditableContentDto })
  @Type(() => EditableContentDto)
  @Allow()
  editableContent: EditableContentDto;

  constructor(
    actionActivity: ActionActivity,
    extra?: {
      comments?: Comment[];
      formResponseOutput?: ParsedFormResponse;
      likedByMe?: boolean;
      requestingUserId?: number;
      facepile?: User[];
    },
  ) {
    super();
    this.id = actionActivity.id;
    this.type = actionActivity.type;
    this.createdAt = actionActivity.createdAt;
    this.actionId = actionActivity.actionId;
    this.likesCount = actionActivity.likesCount;
    this.actionName = loadedActionActivityAction(actionActivity).name;
    this.user = new ProfileDto(loadedActionActivityUser(actionActivity));
    const likers = extra?.facepile ?? actionActivity.likes;
    if (likers !== undefined) {
      this.likes = likers
        .map((like) => new ProfileDto(like))
        .sort(byLikeOrder(actionActivity.id))
        .slice(0, LIKE_FACEPILE_LIMIT);
    }
    this.likedByMe = extra?.likedByMe;
    this.comments =
      extra?.comments?.map(
        (comment) =>
          new CommentDto(comment, {
            requestingUserId: extra?.requestingUserId,
          }),
      ) ?? [];
    this.formResponseOutput = extra?.formResponseOutput
      ? new FormResponseOutputDto(extra.formResponseOutput)
      : undefined;
    this.editableContent = actionActivity.editableContent
      ? new EditableContentDto(actionActivity.editableContent)
      : { body: "", attachments: [], id: -1 };
  }
}

export type WelcomeQueueMember = {
  user: User;
  actionId: number;
  activityId: number;
  completedAt: Date;
  staffLikeCount: number;
};

export type WelcomeQueue = {
  requiredActionCount: number;
  members: WelcomeQueueMember[];
};

export class WelcomeQueueMemberDto {
  @ApiProperty({ type: () => ProfileDto })
  @Type(() => ProfileDto)
  user: ProfileDto;

  @ApiProperty()
  actionId: number;

  @ApiProperty()
  activityId: number;

  @ApiProperty()
  completedAt: Date;

  @ApiProperty()
  staffLikeCount: number;

  constructor(input: WelcomeQueueMember) {
    this.user = new ProfileDto(input.user);
    this.actionId = input.actionId;
    this.activityId = input.activityId;
    this.completedAt = input.completedAt;
    this.staffLikeCount = input.staffLikeCount;
  }
}

export class WelcomeQueueDto {
  @ApiProperty()
  requiredActionCount: number;

  @ApiProperty({ type: () => WelcomeQueueMemberDto, isArray: true })
  @Type(() => WelcomeQueueMemberDto)
  members: WelcomeQueueMemberDto[];

  constructor(input: WelcomeQueue) {
    this.requiredActionCount = input.requiredActionCount;
    this.members = input.members.map(
      (member) => new WelcomeQueueMemberDto(member),
    );
  }
}

export class CreateActionActivityDto extends PickType(ActionActivityDto, [
  "actionId",
  "type",
]) {
  @ApiProperty()
  @IsNumber()
  userId: number;
}

export class UpdateActionActivityDto extends PickType(ActionActivityDto, [
  "editableContent",
]) {}

export class ActionWithdrawalDto extends PickType(ActionActivity, [
  "userId",
  "declineReason",
  "isMoral",
  "outOfTime",
]) {
  constructor(activity: ActionActivity) {
    super();
    this.userId = activity.userId;
    this.declineReason = activity.declineReason;
    this.isMoral = activity.isMoral;
    this.outOfTime = activity.outOfTime;
  }
}
