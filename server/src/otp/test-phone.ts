import { NodeEnv } from "@alliance/common/node-env";
import { env } from "src/config/env";
import { OtpChannel } from "./otp-copy";

export const TEST_PHONE_PREFIX = "+1415555";
export const TEST_PHONE_CODE = "000000";

const TEST_PHONES: Record<NodeEnv, boolean> = {
  [NodeEnv.Production]: false,
  [NodeEnv.Staging]: true,
  [NodeEnv.Development]: true,
  [NodeEnv.Test]: true,
};

/** Numbers that get no text, accept `TEST_PHONE_CODE` and skip rate limits. */
export function isTestPhone(
  contact: { channel: OtpChannel; destination: string },
  nodeEnv: NodeEnv = env("NODE_ENV"),
): boolean {
  return (
    TEST_PHONES[nodeEnv] &&
    contact.channel === OtpChannel.Sms &&
    contact.destination.startsWith(TEST_PHONE_PREFIX)
  );
}
