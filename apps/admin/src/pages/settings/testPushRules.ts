import type { PushDto } from "@alliance/shared/client/types.gen";

/**
 * Why a push the server answered 200 for still didn't go out, or null when
 * Expo accepted it. The server reports Expo's refusal in the push it returns,
 * not as an error status.
 */
export function pushFailureReason(push: PushDto): string | null {
  if (push.ticketStatus === "ok") return null;
  if (push.ticketStatus === null) {
    return "The server's request to Expo failed; the server log has the reason.";
  }
  if (push.errorCode === "DeviceNotRegistered") {
    return "Expo no longer knows this device, and the server removed it from the member's devices.";
  }
  return push.errorMessage
    ? `Expo refused it. ${push.errorMessage}`
    : "Expo refused it.";
}
