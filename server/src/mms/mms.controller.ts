import { normalizePhoneNumber } from "@alliance/common/phone";
import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { MmsUnsubService } from "./mms-unsub.service";
import { TwilioSignatureGuard } from "./twilio-signature.guard";

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
  constructor(private readonly mmsUnsubService: MmsUnsubService) {}

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

    const rawFrom = body.From as string | undefined;
    const rawTo = body.To as string | undefined;
    const text = (body.Body as string | undefined) ?? "";

    if (!rawFrom || !rawTo) {
      console.warn(
        `Missing From/To in Twilio webhook: ${JSON.stringify(body)}`,
      );
      return "";
    }

    const from = normalizePhoneNumber(rawFrom);

    const keyword = text.trim().toUpperCase();

    if (STOP_KEYWORDS.has(keyword)) {
      console.log(`Received STOP from ${from}, marking unsubscribed`);
      await this.mmsUnsubService.unsubFromMms(from, {
        reason: "stop_keyword",
        rawBody: text,
      });
      return "";
    }

    if (START_KEYWORDS.has(keyword)) {
      console.log(`Received START from ${from}, marking subscribed`);
      await this.mmsUnsubService.subscribeToMms(from, { rawBody: text });
      return "";
    }

    await this.mmsUnsubService.logUnhandledMessage(from, rawTo, text);
    return "";
  }
}
