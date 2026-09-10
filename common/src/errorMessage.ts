export function errorMessage(params: {
  error: unknown;
  fallback: string;
}): string {
  const { error, fallback } = params;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.length > 0) return message;
    // NestJS validation errors put an array of messages in `message`.
    if (Array.isArray(message)) {
      const joined = message.filter((m) => typeof m === "string").join(", ");
      if (joined.length > 0) return joined;
    }
  }
  return fallback;
}

// A route writes its own refusals for the reader. A 401 and anything from 5xx
// up carry framework text instead, "Unauthorized" or "Internal Server Error",
// which says nothing the reader can act on.
export function refusalMessage(params: {
  status: number;
  error: unknown;
  fallback: string;
  sessionExpired: string;
}): string {
  const { status, error, fallback, sessionExpired } = params;
  if (status === 401) return sessionExpired;
  if (status >= 500) return fallback;
  return errorMessage({ error, fallback });
}
