import { millisecondsInMinute } from "date-fns/constants";
import { OTP_TTL_MS } from "./otp-limits";

/** What a code is for. Each has its own wording and its own challenges. */
export enum OtpPurpose {
  KoraSignIn = "kora_sign_in",
  PhoneVerification = "phone_verification",
}

export enum OtpChannel {
  Email = "email",
  Sms = "sms",
}

type OtpCopy = {
  codeLabel: string;
  /** Fills "Enter the code above to {emailAction}" in the email body. */
  emailAction: string;
};

/** The same wording whether or not an account exists, so a message reveals neither. */
const OTP_COPY: Record<OtpPurpose, OtpCopy> = {
  [OtpPurpose.KoraSignIn]: {
    codeLabel: "sign-in code",
    emailAction: "continue to Safer Chatbots for Children",
  },
  [OtpPurpose.PhoneVerification]: {
    codeLabel: "phone verification code",
    emailAction: "confirm your phone number",
  },
};

const EXPIRY = `${OTP_TTL_MS / millisecondsInMinute} minutes`;

export function otpEmail(params: { purpose: OtpPurpose; code: string }): {
  subject: string;
  context: { code: string; action: string; expiry: string };
} {
  const copy = OTP_COPY[params.purpose];
  return {
    subject: `Your ${copy.codeLabel} is ${params.code}`,
    context: { code: params.code, action: copy.emailAction, expiry: EXPIRY },
  };
}

/**
 * With a `webOtpHost`, the last line is the WebOTP format, which lets a
 * browser on that host offer the code for autofill.
 */
export function otpText(params: {
  purpose: OtpPurpose;
  code: string;
  webOtpHost: string | null;
}): string {
  const copy = OTP_COPY[params.purpose];
  const text = `Your Alliance ${copy.codeLabel} is ${params.code}. It expires in ${EXPIRY}.`;
  return params.webOtpHost
    ? `${text}\n\n@${params.webOtpHost} #${params.code}`
    : text;
}
