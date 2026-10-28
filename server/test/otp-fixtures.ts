import { R } from "@alliance/common/result";
import { MailService } from "src/mail/mail.service";
import { MmsService } from "src/mms/mms.service";
import { OtpChallenge } from "src/otp/otp-challenge.entity";
import { OtpRateEvent } from "src/otp/otp-rate-event.entity";
import { DeliveryFailure } from "src/utils/notif-delivery";
import type { TestContext } from "./e2e-test-utils";

let unique = 0;
export const uniqueEmail = (): string =>
  `participant-${++unique}-${Math.random()}@example.com`;
const AREA_CODES = ["415", "202", "312", "617", "646"];
let phones = 0;
/** 555-0100 to 555-0199, which no handset uses. */
export const uniquePhone = (): string => {
  const n = phones++;
  return `+1${AREA_CODES[Math.floor(n / 100) % AREA_CODES.length]}5550${100 + (n % 100)}`;
};

export const wrongCode = (code: string): string =>
  String((Number(code) + 1) % 1_000_000).padStart(6, "0");

export type SentCodes = {
  /** The code in the most recent message, by email or text. */
  lastCode: () => string;
  failDelivery: () => void;
};

/** Stubs email and text delivery, keeping each code sent. */
export function captureSentCodes(ctx: TestContext): SentCodes {
  const codes: string[] = [];
  let failNext = false;
  const deliver = <T>(code: string, sent: T) => {
    if (failNext) {
      failNext = false;
      return R.failure(DeliveryFailure.Failed);
    }
    codes.push(code);
    return R.success(sent);
  };
  jest
    .spyOn(ctx.app.get(MailService), "sendUnrecordedMail")
    .mockImplementation(async ({ context }) =>
      deliver(String((context as { code: string }).code), {
        messageId: "message-id",
      }),
    );
  jest
    .spyOn(ctx.app.get(MmsService), "sendUnrecordedText")
    .mockImplementation(async ({ body }) =>
      deliver(/#(\d{6})$/.exec(body)?.[1] ?? "", { sid: "sid" }),
    );
  return {
    lastCode: () => {
      const code = codes.at(-1);
      if (!code) throw new Error("no code was sent");
      return code;
    },
    failDelivery: () => {
      failNext = true;
    },
  };
}

/** Lets the next code for the same contact go out without waiting. */
export async function skipResendWait(ctx: TestContext): Promise<void> {
  await ctx.dataSource
    .getRepository(OtpChallenge)
    .createQueryBuilder()
    .update()
    .set({ createdAt: () => `"createdAt" - interval '61 seconds'` })
    .execute();
}

export async function forgetRateEvents(ctx: TestContext): Promise<void> {
  await ctx.dataSource.getRepository(OtpRateEvent).clear();
}
