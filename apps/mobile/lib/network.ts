// Expo installs expo/fetch as the global fetch, which rejects with a FetchError
// carrying this prefix when a request gets no response. The class isn't
// exported, so the message is all there is to match.
const NETWORK_FAILURE_PREFIX = "fetch failed: ";

export const isNetworkFailure = (error: unknown): boolean =>
  error instanceof Error && error.message.startsWith(NETWORK_FAILURE_PREFIX);
