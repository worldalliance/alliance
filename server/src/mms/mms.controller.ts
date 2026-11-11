import { normalizePhoneNumber } from "@alliance/common/phone";
import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { z } from "zod";
import { MmsThreadService } from "./mms-thread.service";
import { MmsUnsubService } from "./mms-unsub.service";
import { MmsKeyword } from "./mms.entity";
import { TwilioSignatureGuard } from "./twilio-signature.guard";

const addressedTextSchema = z.object({
  From: z.string().min(1),
  To: z.string().min(1),
  Body: z.string().default(""),
});

const inboundFieldsSchema = z.object({ MessageSid: z.string() });

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

    await this.mmsThreadService.recordInbound({
      sid: inboundFieldsSchema.parse(body).MessageSid,
      from,
      to: rawTo,
      body: text,
      keyword,
    });
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
