/** The `error` field of a refused one-time-code request, for clients to branch on. */
export enum OtpError {
  WrongCode = "otp_wrong_code",
  /** Expired, replaced, consumed, or out of attempts: only a new code helps. */
  CodeInvalid = "otp_code_invalid",
  DeliveryFailed = "otp_delivery_failed",
  Throttled = "otp_throttled",
}

export const OTP_CODE_LENGTH = 6;
