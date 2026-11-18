import {
  NON_MEMBER_REPLY_WINDOW_DAYS,
  STAFF_TEXT_MAX_LENGTH,
} from "@alliance/common/staffText";
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
import { User } from "src/user/entities/user.entity";
import { type NeedsReplyMember, ReplyState } from "../mms-inbox.service";
import { MmsMedia } from "../mms-media.entity";
import {
  inlineContentType,
  mediaStatus,
  MmsMediaStatus,
} from "../mms-media.service";
import { MmsThreadEvent, MmsThreadEventKind } from "../mms-thread-event.entity";
import {
  type MmsThreadView,
  type NumberThread,
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

export class MmsThreadEventDto {
  @ApiProperty()
  id: number;

  @ApiProperty({ enum: MmsThreadEventKind, enumName: "MmsThreadEventKind" })
  kind: MmsThreadEventKind;

  @ApiProperty({
    type: String,
    nullable: true,
    description: "Null while that staff member is deleted",
  })
  markedByName: string | null;

  @ApiProperty({ type: Date })
  createdAt: Date;

  constructor(input: MmsThreadEvent) {
    this.id = input.id;
    this.kind = input.kind;
    this.markedByName = input.markedBy?.name ?? null;
    this.createdAt = input.createdAt;
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

  @ApiProperty({
    type: () => MmsThreadEventDto,
    isArray: true,
    description: "Staff actions taken right after this text, oldest first",
  })
  events: MmsThreadEventDto[];

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
    this.events = (input.threadEvents ?? [])
      .toSorted((a, b) => a.id - b.id)
      .map((event) => new MmsThreadEventDto(event));
    this.media = (input.media ?? []).map((media) => new MmsMediaDto(media));
  }
}

const ApiPageMessages = () =>
  ApiProperty({
    type: () => MmsMessageDto,
    isArray: true,
    description: `Up to ${THREAD_PAGE_SIZE} texts, oldest first: the newest, or those sent before \`before\``,
  });

const ApiReplyState = () =>
  ApiProperty({
    enum: ReplyState,
    enumName: "ReplyState",
    description:
      "Whether the number's latest texts need a reply, were marked handled, or were answered (or there are none)",
  });

const ApiPageHasOlder = () =>
  ApiProperty({ description: "Older texts can be loaded with `before`" });

export class MmsThreadDto {
  @ApiProperty({
    type: String,
    nullable: true,
    description:
      "Null when the member has no phone number or it has no thread row yet",
  })
  threadId: string | null;

  @ApiProperty({ type: String, nullable: true })
  phoneNumber: string | null;

  @ApiProperty({
    description:
      "False when the member has no phone number or one staff can't text; opt-out is reported separately in optedOut",
  })
  textable: boolean;

  @ApiProperty()
  optedOut: boolean;

  @ApiReplyState()
  replyState: ReplyState;

  @ApiPageMessages()
  messages: MmsMessageDto[];

  @ApiPageHasOlder()
  hasOlder: boolean;

  constructor(input: MmsThreadView) {
    this.threadId = input.threadId;
    this.phoneNumber = input.phoneNumber;
    this.textable = input.textable;
    this.optedOut = input.optedOut;
    this.replyState = input.replyState;
    this.messages = input.messages.map((message) => new MmsMessageDto(message));
    this.hasOlder = input.hasOlder;
  }
}

export class ThreadMemberDto extends PickType(User, [
  "id",
  "name",
  "timeZone",
]) {
  constructor(input: User) {
    super();
    this.id = input.id;
    this.name = input.name;
    this.timeZone = input.timeZone;
  }
}

export class NumberThreadDto {
  @ApiProperty()
  threadId: string;

  @ApiProperty({ description: "May be a short code or sender id" })
  phoneNumber: string;

  @ApiProperty({
    type: () => ThreadMemberDto,
    isArray: true,
    description: "Non-deleted members with this number",
  })
  members: ThreadMemberDto[];

  @ApiProperty({
    description:
      "False for a number staff can't text, such as a short code; opt-out and the reply window are reported separately in optedOut and replyWindowClosed",
  })
  textable: boolean;

  @ApiProperty()
  optedOut: boolean;

  @ApiProperty({
    description: `True for a number with no member that sent no text in the last ${NON_MEMBER_REPLY_WINDOW_DAYS} days`,
  })
  replyWindowClosed: boolean;

  @ApiReplyState()
  replyState: ReplyState;

  @ApiPageMessages()
  messages: MmsMessageDto[];

  @ApiPageHasOlder()
  hasOlder: boolean;

  constructor(input: NumberThread) {
    this.threadId = input.thread.id;
    this.phoneNumber = input.thread.phoneNumber;
    this.members = input.members.map((member) => new ThreadMemberDto(member));
    this.textable = input.textable;
    this.optedOut = input.optedOut;
    this.replyWindowClosed = input.replyWindowClosed;
    this.replyState = input.replyState;
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

export class MarkThreadDto {
  @ApiProperty({
    description:
      "The newest text staff could see. The mark is shown after it, and marking handled leaves later texts needing a reply",
  })
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  throughId: number;
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
      "The member's latest text that still needs a reply; STOP and START texts and handled texts are skipped",
  })
  lastMessageBody: string;

  @ApiProperty({
    type: Date,
    description:
      "When the member's oldest text that no staff reply has followed and staff haven't marked handled arrived",
  })
  waitingSince: Date;

  constructor(input: NeedsReplyMember) {
    this.userId = input.user.id;
    this.name = input.user.name;
    this.lastMessageBody = input.lastMessageBody;
    this.waitingSince = input.waitingSince;
  }
}
