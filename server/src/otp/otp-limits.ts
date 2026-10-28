import { milliseconds } from "date-fns";

export const OTP_TTL_MS = milliseconds({ minutes: 10 });
export const OTP_RESEND_AFTER_MS = milliseconds({ minutes: 1 });
export const OTP_MAX_WRONG_ATTEMPTS = 5;

export type RateLimit = { max: number; windowMs: number };

export const SEND_LIMITS_PER_CONTACT: RateLimit[] = [
  { max: 5, windowMs: milliseconds({ hours: 1 }) },
  { max: 20, windowMs: milliseconds({ days: 1 }) },
];

export const SEND_LIMITS_PER_IP: RateLimit[] = [
  { max: 30, windowMs: milliseconds({ minutes: 1 }) },
  { max: 200, windowMs: milliseconds({ hours: 1 }) },
];

export const VERIFY_LIMITS_PER_IP: RateLimit[] = [
  { max: 30, windowMs: milliseconds({ minutes: 1 }) },
  { max: 200, windowMs: milliseconds({ hours: 1 }) },
];

export const LONGEST_RATE_WINDOW_MS = Math.max(
  ...[
    ...SEND_LIMITS_PER_CONTACT,
    ...SEND_LIMITS_PER_IP,
    ...VERIFY_LIMITS_PER_IP,
  ].map((limit) => limit.windowMs),
);
