import { ApiProperty, ApiPropertyOptional, PickType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";
import { MmsMedia } from "../mms-media.entity";
import { mediaStatus, MmsMediaStatus } from "../mms-media.service";
import { type MmsThread, THREAD_PAGE_SIZE } from "../mms-thread.service";
import { Mms } from "../mms.entity";

export class MmsMediaDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  contentType: string;

  @ApiProperty({ enum: MmsMediaStatus, enumName: "MmsMediaStatus" })
  status: MmsMediaStatus;

  constructor(input: MmsMedia) {
    this.id = input.id;
    this.contentType = input.contentType;
    this.status = mediaStatus(input);
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
