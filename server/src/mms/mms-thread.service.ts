import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { Repository } from "src/utils/Repository";
import { Mms, MmsDirection, type MmsKeyword } from "./mms.entity";

export type InboundText = {
  sid: string;
  from: string;
  to: string;
  body: string;
  keyword: MmsKeyword | null;
};

@Injectable()
export class MmsThreadService {
  constructor(
    @InjectRepository(Mms)
    private readonly mmsRepository: Repository<Mms>,
  ) {}

  /** Twilio retries a webhook it timed out on, so a repeat SID records nothing. */
  async recordInbound(text: InboundText): Promise<void> {
    await this.mmsRepository
      .createQueryBuilder()
      .insert()
      .into(Mms)
      .values({
        to: text.to,
        from: text.from,
        body: text.body,
        direction: MmsDirection.Inbound,
        keyword: text.keyword,
        status: "received",
        twilioSid: text.sid,
        errorCode: null,
        errorMessage: null,
        cid: null,
      })
      .orIgnore()
      .execute();
  }
}
