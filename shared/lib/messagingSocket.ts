import { R, type Result } from "@alliance/common/result";
import { SocketRefusal } from "@alliance/common/socketRefusal";
import { retry } from "es-toolkit";
import { io, Socket } from "socket.io-client";

export type MessagingConnectionConfig = {
  getWebSocketUrl: () => string;
  /** Omitted, the server authenticates the handshake by the session cookie alone. */
  getAuthToken?: () => Promise<string | null> | string | null;
  /** Must store the refreshed token where getAuthToken reads it, or set the
   * refreshed cookie, before returning R.success(true).
   * Returns R.success(false) when the session is absent or refused.
   * Returns R.failure when refresh fails without establishing whether the session is valid. */
  onRefreshToken?: () => Promise<Result<boolean, Error>>;
};

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

const buildSocketOptions = ({
  getAuthToken,
  onRefreshToken,
}: MessagingConnectionConfig) => {
  if (!getAuthToken) {
    // Cookies go only with a connection's opening request, so a socket sharing
    // another's connection would retry a refused handshake with the old cookie.
    return {
      transports: ["websocket"],
      withCredentials: true,
      forceNew: onRefreshToken !== undefined,
    };
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

const backoffMs = (attempt: number) => Math.min(1000 * 2 ** attempt, 30000);

/** The server refuses as "Unavailable" when it couldn't check the session, and
 * Socket.IO doesn't retry a handshake its middleware refused. */
const retryUnavailable = (socket: Socket) => {
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const onConnect = () => {
    attempt = 0;
  };
  const onConnectError = (err: Error) => {
    if (err.message !== SocketRefusal.Unavailable) return;
    clearTimeout(timer);
    // Jittered so admins refused by one outage don't retry in lockstep.
    const delayMs = Math.round(backoffMs(attempt++) * (0.5 + Math.random()));
    console.warn(
      `Socket handshake refused as unavailable; retrying in ${delayMs} ms`,
    );
    timer = setTimeout(() => socket.connect(), delayMs);
  };
  socket.on("connect", onConnect);
  socket.on("connect_error", onConnectError);
  return () => {
    clearTimeout(timer);
    socket.off("connect", onConnect);
    socket.off("connect_error", onConnectError);
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
    // The server refuses as "Unavailable" only after the token verified.
    if (err.message === SocketRefusal.Unavailable) refreshed = false;
    if (refreshing || controller.signal.aborted) return;
    if (
      !err.message?.includes("jwt expired") &&
      !err.message?.includes(SocketRefusal.Unauthorized)
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
          delay: backoffMs,
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
    buildSocketOptions(config),
  );
  const stopAuthRefresh = attachAuthRefresh(socket, config.onRefreshToken);
  const stopRetry = retryUnavailable(socket);
  const close = () => {
    stopAuthRefresh?.();
    stopRetry();
    socket.disconnect();
  };
  return { socket, close };
};
