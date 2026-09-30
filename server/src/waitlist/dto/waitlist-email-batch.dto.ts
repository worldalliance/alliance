import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsUUID } from "class-validator";
import type { WaitlistEmailBatch } from "../entities/waitlist-email-batch.entity";
import { WaitlistEmailRecipientStatus } from "../entities/waitlist-email-recipient.entity";
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
