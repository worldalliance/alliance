import { randomUUID } from "crypto";
import { MmsMedia } from "src/mms/mms-media.entity";
import { Mms, MmsDirection } from "src/mms/mms.entity";
import type { DataSource } from "typeorm";

export const TWILIO_NUMBER = "+15555550100";
export const MEDIA_URL =
  "https://api.twilio.com/2010-04-01/Accounts/AC123/Messages/MM123/Media/ME123";

export async function saveInboundMedia(
  dataSource: DataSource,
  params: { from: string } & Partial<
    Pick<
      MmsMedia,
      | "contentType"
      | "createdAt"
      | "copyAttempts"
      | "lastCopyAttemptAt"
      | "s3Key"
      | "twilioDeleteAttempts"
      | "lastTwilioDeleteAttemptAt"
    >
  >,
): Promise<MmsMedia> {
  const { from, ...media } = params;
  const mmsRepo = dataSource.getRepository(Mms);
  const mms = await mmsRepo.save(
    mmsRepo.create({
      to: TWILIO_NUMBER,
      from,
      direction: MmsDirection.Inbound,
      body: "",
      status: "received",
      twilioSid: randomUUID(),
    }),
  );
  const mediaRepo = dataSource.getRepository(MmsMedia);
  return mediaRepo.save(
    mediaRepo.create({
      mmsId: mms.id,
      twilioUrl: MEDIA_URL,
      contentType: "image/png",
      s3Key: null,
      ...media,
    }),
  );
}
