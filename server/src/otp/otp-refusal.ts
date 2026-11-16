import { OtpError } from "@alliance/common/otp";
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  ServiceUnavailableException,
} from "@nestjs/common";
import { formatDistanceStrict } from "date-fns";
import { OtpPurpose } from "./otp-copy";
import type { OtpStartRefusal, OtpVerifyRefusal } from "./otp.service";

const DELIVERY_FAILED_MESSAGE: Record<OtpPurpose, string> = {
  [OtpPurpose.KoraSignIn]:
    "We couldn’t send your code. Try again later or use another sign-in method.",
  [OtpPurpose.PhoneVerification]:
    "We couldn’t send a code to this number. Check the number or try again later.",
};

export const WRONG_CODE_MESSAGE = "That code isn’t correct. Try again.";

/** Carries the copy a client shows and, as `error`, the {@link OtpError}. */
export function otpRefusalException(
  refusal: OtpStartRefusal | OtpVerifyRefusal,
  purpose: OtpPurpose,
): HttpException {
  switch (refusal.error) {
    case OtpError.WrongCode:
      return new BadRequestException(WRONG_CODE_MESSAGE, {
        description: refusal.error,
      });
    case OtpError.CodeInvalid:
      return new BadRequestException(
        "That code is no longer valid. Request a new code.",
        { description: refusal.error },
      );
    case OtpError.DeliveryFailed:
      return new ServiceUnavailableException(DELIVERY_FAILED_MESSAGE[purpose], {
        description: refusal.error,
      });
    case OtpError.Throttled: {
      const wait = formatDistanceStrict(refusal.retryAt, new Date(), {
        roundingMethod: "ceil",
      });
      return new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Too many attempts. Try again in ${wait}.`,
          error: refusal.error,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    default:
      throw new Error(`unknown refusal: ${refusal satisfies never}`);
  }
}
