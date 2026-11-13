import { STAFF_TEXT_MAX_LENGTH } from "@alliance/common/staffText";
import { ApiProperty, ApiPropertyOptional, PickType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateBy,
} from "class-validator";
import { MmsMedia } from "../mms-media.entity";
import {
  inlineContentType,
  mediaStatus,
  MmsMediaStatus,
} from "../mms-media.service";
import {
  type MmsThread,
  type NeedsReplyMember,
  THREAD_PAGE_SIZE,
} from "../mms-thread.service";
import { Mms } from "../mms.entity";

export class MmsMediaDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  contentType: string;

  @ApiProperty({ enum: MmsMediaStatus, enumName: "MmsMediaStatus" })
  status: MmsMediaStatus;

  @ApiProperty({ description: "Safe to render in an <img>" })
  inline: boolean;

  constructor(input: MmsMedia) {
    this.id = input.id;
    this.contentType = input.contentType;
    this.status = mediaStatus(input);
    this.inline = inlineContentType(input.contentType) !== undefined;
  }
}

export class MmsMessageDto extends PickType(Mms, [
  "id",
  "direction",
  "body",
  "status",
  "errorCode",
  "errorMessage",
  "createdAt",
]) {
  @ApiProperty({
    description:
      "True for texts staff wrote, even once the sender is deleted; false for automated and inbound texts",
  })
  sentByStaff: boolean;

  @ApiProperty({ type: String, nullable: true })
  sentByName: string | null;

  @ApiProperty({ type: () => MmsMediaDto, isArray: true })
  media: MmsMediaDto[];

  constructor(input: Mms) {
    super();
    this.id = input.id;
    this.direction = input.direction;
    this.body = input.body;
    this.status = input.status;
    this.errorCode = input.errorCode;
    this.errorMessage = input.errorMessage;
    this.createdAt = input.createdAt;
    this.sentByStaff = input.sentById !== null;
    this.sentByName = input.sentBy?.name ?? null;
    this.media = (input.media ?? []).map((media) => new MmsMediaDto(media));
  }
}

export class MmsThreadDto {
  @ApiProperty({ type: String, nullable: true })
  phoneNumber: string | null;

  @ApiProperty({
    description:
      "False when the member has no phone number or one staff can't text; opt-out is reported separately in optedOut",
  })
  textable: boolean;

  @ApiProperty()
  optedOut: boolean;

  @ApiProperty({
    type: () => MmsMessageDto,
    isArray: true,
    description: `Up to ${THREAD_PAGE_SIZE} texts, oldest first: the newest, or those sent before \`before\``,
  })
  messages: MmsMessageDto[];

  @ApiProperty({ description: "Older texts can be loaded with `before`" })
  hasOlder: boolean;

  constructor(input: MmsThread) {
    this.phoneNumber = input.phoneNumber;
    this.textable = input.textable;
    this.optedOut = input.optedOut;
    this.messages = input.messages.map((message) => new MmsMessageDto(message));
    this.hasOlder = input.hasOlder;
  }
}

export class MmsThreadQueryDto {
  @ApiPropertyOptional({
    description: "Return texts sent before the text with this id",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  before?: number;
}

export class SendStaffTextDto {
  @ApiProperty({ minLength: 1, maxLength: STAFF_TEXT_MAX_LENGTH })
  @IsString()
  @ValidateBy({
    name: "maxCodeUnits",
    validator: {
      validate: (value) =>
        typeof value === "string" && value.length <= STAFF_TEXT_MAX_LENGTH,
      defaultMessage: () =>
        `body must be at most ${STAFF_TEXT_MAX_LENGTH} characters`,
    },
  })
  @Matches(/\S/, { message: "body must not be blank" })
  body: string;
}

export class NeedsReplyMemberDto {
  @ApiProperty()
  userId: number;

  @ApiProperty()
  name: string;

  @ApiProperty({
    description:
      "The member's latest text that still needs a reply; STOP and START texts are skipped",
  })
  lastMessageBody: string;

  @ApiProperty({
    type: Date,
    description:
      "When the member's oldest text no staff reply has followed arrived",
  })
  waitingSince: Date;

  constructor(input: NeedsReplyMember) {
    this.userId = input.user.id;
    this.name = input.user.name;
    this.lastMessageBody = input.lastMessageBody;
    this.waitingSince = input.waitingSince;
  }
}
