import { R, type Result } from "@alliance/common/result";
import { retry } from "es-toolkit";
import { io, Socket } from "socket.io-client";

export type MessagingConnectionConfig = {
  getWebSocketUrl: () => string;
} & (
  | {
      getAuthToken: () => Promise<string | null> | string | null;
      /** Must store the refreshed token where getAuthToken reads it before returning R.success(true).
       * Returns R.success(false) when the session is absent or refused.
       * Returns R.failure when refresh fails without establishing whether the session is valid. */
      onRefreshToken?: () => Promise<Result<boolean, Error>>;
    }
  | { getAuthToken?: undefined; onRefreshToken?: undefined }
);

const resolveAuthToken = async (
  getAuthToken?: () => Promise<string | null> | string | null,
) => {
  if (!getAuthToken) return null;
  try {
    const token = getAuthToken();
    if (token && typeof (token as Promise<string | null>).then === "function") {
      return await token;
    }
    return token ?? null;
  } catch (error) {
    console.error("Failed to resolve messaging auth token", error);
    return null;
  }
};

const buildSocketOptions = (
  getAuthToken?: () => Promise<string | null> | string | null,
) => {
  if (!getAuthToken) {
    return { transports: ["websocket"], withCredentials: true };
  }
  return {
    transports: ["websocket"],
    withCredentials: true,
    auth: async (cb: (data: Record<string, unknown>) => void) => {
      const token = await resolveAuthToken(getAuthToken);
      cb(token ? { token } : {});
    },
  };
};

const attachAuthRefresh = (
  socket: Socket,
  onRefreshToken?: () => Promise<Result<boolean, Error>>,
) => {
  if (!onRefreshToken) return;
  const controller = new AbortController();
  let refreshing = false;
  let refreshed = false;
  const onConnect = () => {
    refreshed = false;
  };
  const onConnectError = async (err: Error) => {
    if (refreshing || controller.signal.aborted) return;
    if (
      !err.message?.includes("jwt expired") &&
      !err.message?.includes("Unauthorized")
    ) {
      return;
    }
    if (refreshed) {
      console.error("Socket authentication failed after token refresh", err);
      socket.disconnect();
      return;
    }
    refreshing = true;
    try {
      const hasSession = await retry(
        async () => R.unwrap(await onRefreshToken()),
        {
          signal: controller.signal,
          delay: (attempt) => Math.min(1000 * 2 ** attempt, 30000),
          shouldRetry: (error) => {
            if (controller.signal.aborted) return false;
            console.error("Socket token refresh failed", error);
            return true;
          },
        },
      );
      if (controller.signal.aborted) return;
      if (hasSession) {
        refreshed = true;
        socket.connect();
      } else {
        socket.disconnect();
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error("Socket token refresh failed", error);
      }
    } finally {
      refreshing = false;
    }
  };
  socket.on("connect", onConnect);
  socket.on("connect_error", onConnectError);
  return () => {
    controller.abort();
    socket.off("connect", onConnect);
    socket.off("connect_error", onConnectError);
  };
};

export const connectMessagingSocket = (
  namespace: string,
  config: MessagingConnectionConfig,
) => {
  const socket = io(
    `${config.getWebSocketUrl()}${namespace}`,
    buildSocketOptions(config.getAuthToken),
  );
  const stopAuthRefresh = attachAuthRefresh(socket, config.onRefreshToken);
  const close = () => {
    stopAuthRefresh?.();
    socket.disconnect();
  };
  return { socket, close };
};
