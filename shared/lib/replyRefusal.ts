import { refusalMessage } from "@alliance/common/errorMessage";

export const replyRefusalMessage = (params: {
  status: number;
  error: unknown;
}): string => {
  if (params.status >= 500) {
    console.error("The server failed the reply:", params.error);
  }
  return refusalMessage({
    ...params,
    fallback: "Failed to submit reply",
    sessionExpired: "Your session has expired. Sign in again to reply.",
  });
};
