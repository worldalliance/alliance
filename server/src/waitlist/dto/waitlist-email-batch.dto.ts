import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsUUID } from "class-validator";
import type { WaitlistEmailBatch } from "../entities/waitlist-email-batch.entity";
import {
  type WaitlistEmailRecipient,
  WaitlistEmailRecipientStatus,
} from "../entities/waitlist-email-recipient.entity";
import { WaitlistEmailSkipReason } from "../waitlist-email-audience";
import { WaitlistEmailAudienceDto } from "./waitlist-email.dto";

export class SendWaitlistEmailDto extends WaitlistEmailAudienceDto {
  @ApiProperty({
    description: "One per confirmed send; repeating it creates nothing",
  })
  @IsUUID()
  requestId: string;

  @ApiProperty({
    description: "Mark each waiting recipient mobilized once it's sent",
  })
  @IsBoolean()
  mobilize: boolean;
}

export class RetryWaitlistEmailDto {
  @ApiProperty({
    description: "Also resend recipients whose email may already have gone out",
  })
  @IsBoolean()
  includeUncertain: boolean;
}

export type WaitlistEmailCounts = Record<WaitlistEmailRecipientStatus, number>;

export class WaitlistEmailCountsDto {
  @ApiProperty()
  pending: number;

  @ApiProperty()
  sending: number;

  @ApiProperty()
  sent: number;

  @ApiProperty()
  failed: number;

  @ApiProperty()
  uncertain: number;

  @ApiProperty()
  skipped: number;

  constructor(input: WaitlistEmailCounts) {
    this.pending = input[WaitlistEmailRecipientStatus.Pending];
    this.sending = input[WaitlistEmailRecipientStatus.Sending];
    this.sent = input[WaitlistEmailRecipientStatus.Sent];
    this.failed = input[WaitlistEmailRecipientStatus.Failed];
    this.uncertain = input[WaitlistEmailRecipientStatus.Uncertain];
    this.skipped = input[WaitlistEmailRecipientStatus.Skipped];
  }
}

export type WaitlistEmailBatchSummary = {
  batch: WaitlistEmailBatch;
  counts: WaitlistEmailCounts;
};

export class WaitlistEmailBatchDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  subject: string;

  @ApiProperty()
  body: string;

  @ApiProperty()
  mobilize: boolean;

  @ApiProperty()
  includeClaimed: boolean;

  @ApiProperty({ type: String, nullable: true })
  staffName: string | null;

  @ApiProperty({ type: Date })
  createdAt: Date;

  @ApiProperty({ type: () => WaitlistEmailCountsDto })
  counts: WaitlistEmailCountsDto;

  constructor(input: WaitlistEmailBatchSummary) {
    const { batch } = input;
    if (batch.staffUserId !== null && !batch.staffUser) {
      throw new Error(`staff user of waitlist email ${batch.id} not loaded`);
    }
    this.id = batch.id;
    this.subject = batch.subject;
    this.body = batch.body;
    this.mobilize = batch.mobilize;
    this.includeClaimed = batch.includeClaimed;
    this.staffName = batch.staffUser?.name ?? null;
    this.createdAt = batch.createdAt;
    this.counts = new WaitlistEmailCountsDto(input.counts);
  }
}

export class WaitlistEmailRecipientDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  entryId: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;

  @ApiProperty({
    enum: WaitlistEmailRecipientStatus,
    enumName: "WaitlistEmailRecipientStatus",
  })
  status: WaitlistEmailRecipientStatus;

  @ApiProperty({
    enum: WaitlistEmailSkipReason,
    enumName: "WaitlistEmailSkipReason",
    nullable: true,
  })
  skipReason: WaitlistEmailSkipReason | null;

  @ApiProperty({ type: String, nullable: true })
  error: string | null;

  @ApiProperty({ type: Date, nullable: true })
  acceptedAt: Date | null;

  constructor(input: WaitlistEmailRecipient) {
    if (!input.entry) {
      throw new Error(
        `entry of waitlist email recipient ${input.id} not loaded`,
      );
    }
    this.id = input.id;
    this.entryId = input.entryId;
    this.name = input.entry.name;
    this.email = input.entry.email;
    this.status = input.status;
    this.skipReason = input.skipReason;
    this.error = input.error;
    this.acceptedAt = input.acceptedAt;
  }
}

export type WaitlistEmailBatchDetail = WaitlistEmailBatchSummary & {
  recipients: WaitlistEmailRecipient[];
};

export class WaitlistEmailBatchDetailDto extends WaitlistEmailBatchDto {
  @ApiProperty({ type: () => WaitlistEmailRecipientDto, isArray: true })
  recipients: WaitlistEmailRecipientDto[];

  constructor(input: WaitlistEmailBatchDetail) {
    super(input);
    this.recipients = input.recipients.map(
      (recipient) => new WaitlistEmailRecipientDto(recipient),
    );
  }
}
