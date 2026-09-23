import { AnalyticsEvent, ExceptionEvent } from "@alliance/common/analytics";
import type { OAuthProvider } from "@alliance/common/oauth";
import { R, type Result } from "@alliance/common/result";
import { run } from "@alliance/common/run";
import { captureEvent, captureException } from "@alliance/shared/lib/analytics";
import { useBackfillTimeZone } from "@alliance/shared/lib/useBackfillTimeZone";
import type { QueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { usePostHog } from "posthog-react-native";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Alert } from "react-native";
import { authMe, UserDto, type SessionTokensDto } from "../../../shared/client";
import { clearGuestToken, getStoredGuestToken } from "./guestSession";
import { signInWithProvider } from "./oauth";
import { thrownFailure, type OAuthFailure } from "./oauthResult";
import {
  getAccessToken,
  getRefreshToken,
  saveSessionTokens,
  SecureStorage,
  SecureStorageKey,
} from "./SecureStorage";
import {
  clearClosedSessionTokens,
  clearStoredTokens,
  closeSession,
  openSession,
  requestTokens,
  restoreSession,
  retryClearTokens,
  SessionOvertakenError,
} from "./session";
import {
  getVisualTestAutoLoginCredentials,
  isVisualTestMode,
} from "./visualTest";

export type LoginParams = {
  email: string;
  password: string;
  /** Onboarding routes on from here itself, so it opts out of the jump home. */
  navigateOnSuccess?: boolean;
};

interface AuthContextType {
  isAuthenticated: boolean;
  /** The launch couldn't load the session or rule it out. */
  sessionUnavailable: boolean;
  retrySession: () => void;
  user: UserDto | undefined;
  login: (params: LoginParams) => Promise<void>;
  /** Leaves navigation to the caller, as `navigateOnSuccess: false` does. */
  loginWithProvider: (
    provider: OAuthProvider,
  ) => Promise<Result<void, OAuthFailure>>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const clearSessionTokens = () =>
  clearStoredTokens(SecureStorage, [
    SecureStorageKey.ACCESS_TOKEN,
    SecureStorageKey.REFRESH_TOKEN,
  ]);

const askToRetryLogout = () =>
  new Promise<boolean>((resolve) =>
    Alert.alert(
      "Couldn't finish logging out",
      "Your login is still saved on this device, so the app will sign you back in the next time it opens.",
      [
        { text: "Close", style: "cancel", onPress: () => resolve(false) },
        { text: "Try again", onPress: () => resolve(true) },
      ],
    ),
  );

export const AuthProvider: React.FC<
  React.PropsWithChildren<{
    queryClient: QueryClient;
  }>
> = ({ children, queryClient }) => {
  const [user, setUser] = useState<UserDto | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [sessionUnavailable, setSessionUnavailable] = useState(false);
  const router = useRouter();

  useBackfillTimeZone(user);

  const clearTokensAndReport = useCallback(async () => {
    const cleared = await clearSessionTokens();
    if (!cleared.ok) {
      console.error("failed to clear the session tokens", cleared.error);
      captureException(ExceptionEvent.ClearSessionTokensFailed, cleared.error);
    }
    return cleared;
  }, []);

  const clearSession = useCallback(() => {
    const closed = closeSession(clearTokensAndReport);
    queryClient.clear();
    setUser(undefined);
    setSessionUnavailable(false);
    return closed;
  }, [clearTokensAndReport, queryClient]);

  const logout = useCallback(() => {
    run(async () => {
      const closed = await clearSession();
      if (!closed.ok) {
        await retryClearTokens({
          clearTokens: () => clearClosedSessionTokens(clearSessionTokens),
          askToRetry: askToRetryLogout,
        });
      }
    });
    if (!isVisualTestMode) {
      router.replace("/onboarding");
    }
  }, [router, clearSession]);

  const refreshUser = useCallback(async () => {
    try {
      const profile = (await authMe()).data;
      setUser(profile?.user);
    } catch {
      // Leave current user on transient failure; session refresh handles auth.
    }
  }, []);

  const posthog = usePostHog();

  const restoreStoredSession = useCallback(async () => {
    setIsLoading(true);
    setSessionUnavailable(false);
    try {
      // refreshingFetch refreshes an expired access token and retries
      // before this call returns.
      const restored = await restoreSession({
        getAccessToken,
        getRefreshToken,
        dropSession: async () => {
          captureEvent(AnalyticsEvent.AuthFailedToRefresh);
          // No redirect: the app layout already sends an unauthenticated
          // visitor to onboarding.
          await clearSession();
        },
        reportFailure: (error) =>
          captureException(ExceptionEvent.SessionLoadFailed, error),
      });
      if (!restored.ok) {
        if (!(restored.error instanceof SessionOvertakenError)) {
          setSessionUnavailable(true);
        }
        return;
      }
      setUser(restored.value);
    } finally {
      setIsLoading(false);
    }
  }, [clearSession]);

  useEffect(() => {
    run(restoreStoredSession);
  }, [restoreStoredSession]);

  const startSession = useCallback(
    async (tokens: SessionTokensDto) => {
      queryClient.clear();

      const opened = await openSession({
        tokens,
        saveTokens: saveSessionTokens,
        clearTokens: clearTokensAndReport,
      });
      if (!opened.ok) {
        throw opened.error;
      }

      const user = opened.value;
      setUser(user);
      setSessionUnavailable(false);
      posthog?.identify(user.id.toString(), {
        email: user.email,
        name: user.name,
      });
    },
    [clearTokensAndReport, posthog, queryClient],
  );

  const login = useCallback(
    async ({ email, password, navigateOnSuccess = true }: LoginParams) => {
      setIsLoading(true);
      try {
        const guestToken = (await getStoredGuestToken()) ?? undefined;
        const requested = await requestTokens({ email, password, guestToken });
        if (!requested.ok) {
          throw requested.error;
        }
        if (guestToken) {
          await clearGuestToken();
        }

        await startSession(requested.value);

        if (!isVisualTestMode && navigateOnSuccess) {
          router.replace("/");
        }
      } catch (error) {
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [router, startSession],
  );

  const loginWithProvider = useCallback(
    async (provider: OAuthProvider): Promise<Result<void, OAuthFailure>> => {
      const attempt = await R.fromPromiseFn(
        async (): Promise<Result<void, OAuthFailure>> => {
          const guestToken = (await getStoredGuestToken()) ?? undefined;
          const signedIn = await signInWithProvider({ provider, guestToken });
          if (!signedIn.ok) {
            return signedIn;
          }
          if (guestToken) {
            await clearGuestToken();
          }
          await startSession(signedIn.value);
          return R.success(undefined);
        },
        thrownFailure,
      );
      return R.flatMap(attempt, (result) => result);
    },
    [startSession],
  );

  useEffect(() => {
    const visualTestCredentials = getVisualTestAutoLoginCredentials();
    const devAutoLoginEnabled =
      __DEV__ && process.env.EXPO_PUBLIC_DEV_AUTO_LOGIN === "true";

    const credentials = visualTestCredentials
      ? visualTestCredentials
      : devAutoLoginEnabled &&
          process.env.EXPO_PUBLIC_DEV_EMAIL &&
          process.env.EXPO_PUBLIC_DEV_PASSWORD
        ? {
            email: process.env.EXPO_PUBLIC_DEV_EMAIL,
            password: process.env.EXPO_PUBLIC_DEV_PASSWORD,
          }
        : null;

    if (!credentials || isLoading || user) {
      return;
    }

    login({ email: credentials.email, password: credentials.password })
      .then(() => {
        console.log("auto login successful");
      })
      .catch((error) => {
        console.error("auto login failed", error);
      });
  }, [isLoading, login, user]);

  const value: AuthContextType = {
    isAuthenticated: !!user,
    user,
    login,
    loginWithProvider,
    logout,
    refreshUser,
    sessionUnavailable,
    retrySession: () => run(restoreStoredSession),
    isLoading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
};
