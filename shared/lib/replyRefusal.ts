import { ExceptionEvent } from "@alliance/common/analytics";
import { refusalMessage } from "@alliance/common/errorMessage";
import { captureException } from "./analytics";

export const replyRefusalMessage = (params: {
  status: number;
  error: unknown;
}): string => {
  const { status, error } = params;
  if (status >= 500) {
    console.error("The server failed the reply:", error);
    captureException(ExceptionEvent.PostReplyError, error, { status });
  }
  return refusalMessage({
    status,
    error,
    fallback: "Failed to submit reply",
    sessionExpired: "Your session has expired. Sign in again to reply.",
  });
};
