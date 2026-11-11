import { normalizePhoneNumber } from "@alliance/common/phone";
import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { z } from "zod";
import { MmsMediaService } from "./mms-media.service";
import { type InboundText, MmsThreadService } from "./mms-thread.service";
import { MmsUnsubService } from "./mms-unsub.service";
import { MmsKeyword } from "./mms.entity";
import { TwilioSignatureGuard } from "./twilio-signature.guard";

const addressedTextSchema = z.object({
  From: z.string().min(1),
  To: z.string().min(1),
  Body: z.string().default(""),
});

const inboundFieldsSchema = z.object({
  MessageSid: z.string(),
  NumMedia: z.coerce.number().int().min(0).default(0),
});

const attachmentSchema = z.object({
  /** Copying a file sends our Twilio credentials to this URL. */
  url: z.url({ protocol: /^https$/, hostname: /^api\.twilio\.com$/ }),
  contentType: z.string(),
});

/** Leaves out an attachment that fails the check, so the text is still recorded. */
function inboundMedia(params: {
  body: Record<string, unknown>;
  sid: string;
  count: number;
}): InboundText["media"] {
  const { body, sid, count } = params;
  return Array.from({ length: count }, (_, index) => index).flatMap((index) => {
    const attachment = attachmentSchema.safeParse({
      url: body[`MediaUrl${index}`],
      contentType: body[`MediaContentType${index}`],
    });
    if (attachment.success) return [attachment.data];
    console.error(
      `Dropped attachment ${index} of inbound text ${sid}: ${z.prettifyError(attachment.error)}`,
    );
    return [];
  });
}

const STOP_KEYWORDS = new Set([
  "STOP",
  "STOPALL",
  "UNSUBSCRIBE",
  "CANCEL",
  "END",
  "QUIT",
  "REVOKE",
  "OPTOUT",
]);

const START_KEYWORDS = new Set(["START", "YES", "UNSTOP"]);

@Controller("mms")
export class MmsController {
  constructor(
    private readonly mmsUnsubService: MmsUnsubService,
    private readonly mmsThreadService: MmsThreadService,
    private readonly mmsMediaService: MmsMediaService,
  ) {}

  /**
   * Twilio inbound webhook: the response body is returned to Twilio as TwiML,
   * so it must stay a primitive string rather than a DTO — JSON-wrapping it
   * would break Twilio's response handling.
   */
  @Post("inbound")
  @UseGuards(TwilioSignatureGuard)
  @ApiOkResponse({ type: String })
  async handleInboundMms(
    @Body() body: Record<string, unknown>,
  ): Promise<string> {
    // body will be application/x-www-form-urlencoded, e.g.:
    // {
    //   "From": "+15551234567",
    //   "To": "+15559876543",
    //   "Body": "stop",
    //   "NumMedia": "1",
    //   "MediaUrl0": "https://api.twilio.com/....",
    //   ...
    // }

    const addressed = addressedTextSchema.safeParse(body);
    if (!addressed.success) {
      console.warn(
        `Missing or malformed ${addressed.error.issues.map((issue) => issue.path.join(".")).join(", ")} in Twilio webhook`,
      );
      return "";
    }
    const { From: rawFrom, To: rawTo, Body: text } = addressed.data;

    const from = normalizePhoneNumber(rawFrom);

    // Before recording, so a failed write can't lose an opt-out.
    const keyword = await this.handleKeyword({ from, to: rawTo, text });

    const { MessageSid: sid, NumMedia: count } =
      inboundFieldsSchema.parse(body);
    const media = await this.mmsThreadService.recordInbound({
      sid,
      from,
      to: rawTo,
      body: text,
      keyword,
      media: inboundMedia({ body, sid, count }),
    });
    void this.mmsMediaService.copyToS3(media);
    return "";
  }

  private async handleKeyword(params: {
    from: string;
    to: string;
    text: string;
  }): Promise<MmsKeyword | null> {
    const { from, to, text } = params;
    const keyword = text.trim().toUpperCase();

    if (STOP_KEYWORDS.has(keyword)) {
      console.log(`Received STOP from ${from}, marking unsubscribed`);
      await this.mmsUnsubService.unsubFromMms(from, {
        reason: "stop_keyword",
        rawBody: text,
      });
      return MmsKeyword.Stop;
    }

    if (START_KEYWORDS.has(keyword)) {
      console.log(`Received START from ${from}, marking subscribed`);
      await this.mmsUnsubService.subscribeToMms(from, { rawBody: text });
      return MmsKeyword.Start;
    }

    await this.mmsUnsubService.logUnhandledMessage(from, to, text);
    return null;
  }
}
