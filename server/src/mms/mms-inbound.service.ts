import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { InjectRepository } from "@nestjs/typeorm";
import type { Repository } from "src/utils/Repository";
import { z } from "zod";
import { MmsMedia } from "./mms-media.entity";
import { MmsNumberService } from "./mms-number.service";
import { Mms, MmsDirection, type MmsKeyword } from "./mms.entity";
import { emitThreadChanged } from "./mms.events";

export type InboundText = {
  sid: string;
  from: string;
  to: string;
  body: string;
  keyword: MmsKeyword | null;
  media: { url: string; contentType: string }[];
};

@Injectable()
export class MmsInboundService {
  constructor(
    @InjectRepository(Mms)
    private readonly mmsRepository: Repository<Mms>,
    private readonly mmsNumberService: MmsNumberService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** Twilio retries a webhook it timed out on, so a repeat SID records nothing. */
  async recordInbound(text: InboundText): Promise<MmsMedia[]> {
    const media = await this.insertInbound(text);
    if (media === null) return [];
    emitThreadChanged(this.eventEmitter, {
      phoneNumber: text.from,
      needsReplyChanged: true,
    });
    return media;
  }

  /** Null when the SID was already recorded. */
  private insertInbound(text: InboundText): Promise<MmsMedia[] | null> {
    return this.mmsRepository.manager.transaction(async (manager) => {
      await this.mmsNumberService.ensureThread(text.from, manager);
      const inserted = await manager
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
          sentById: null,
        })
        .orIgnore()
        .returning(["id"])
        .execute();
      const row: unknown = inserted.raw[0];
      if (row === undefined) return null;
      const { id: mmsId } = z.object({ id: z.coerce.number() }).parse(row);
      const mediaRepository = manager.getRepository(MmsMedia);
      return mediaRepository.save(
        text.media.map(({ url, contentType }) =>
          mediaRepository.create({
            mmsId,
            twilioUrl: url,
            contentType,
            s3Key: null,
          }),
        ),
      );
    });
  }
}
