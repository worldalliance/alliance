import { AnalyticsEvent, ExceptionEvent } from "@alliance/common/analytics";
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
import {
  appHealthCheck,
  authLogin,
  authMe,
  type SessionTokensDto,
  UserDto,
} from "../../../shared/client";
import { clearGuestToken, getStoredGuestToken } from "./guestSession";
import { SecureStorage, SecureStorageKey } from "./SecureStorage";
import {
  clearStoredTokens,
  closeSession,
  openSession,
  retryClearTokens,
  setAuthHeader,
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
  canConnectToServer: boolean;
  user: UserDto | undefined;
  login: (params: LoginParams) => Promise<void>;
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
  const [canConnectToServer, setCanConnectToServer] = useState<boolean>(false);
  const router = useRouter();

  useBackfillTimeZone(user);

  const saveTokens = useCallback(async (access: string, refresh: string) => {
    await SecureStorage.setItem(SecureStorageKey.ACCESS_TOKEN, access);
    await SecureStorage.setItem(SecureStorageKey.REFRESH_TOKEN, refresh);
  }, []);

  const clearTokensAndReport = useCallback(async () => {
    const cleared = await clearSessionTokens();
    if (!cleared.ok) {
      console.error("failed to clear the session tokens", cleared.error);
      captureException(ExceptionEvent.ClearSessionTokensFailed, cleared.error);
    }
    return cleared;
  }, []);

  const getAccessToken = useCallback(async () => {
    return await SecureStorage.getItem(SecureStorageKey.ACCESS_TOKEN);
  }, []);
  const clearSession = useCallback(() => {
    const closed = closeSession(clearTokensAndReport);
    queryClient.clear();
    setUser(undefined);
    return closed;
  }, [clearTokensAndReport, queryClient]);

  const logout = useCallback(() => {
    run(async () => {
      const closed = await clearSession();
      if (!closed.ok) {
        await retryClearTokens({
          clearTokens: clearSessionTokens,
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

  useEffect(() => {
    (async () => {
      try {
        const accessToken = await getAccessToken();
        if (accessToken) {
          setAuthHeader(accessToken);
        }
        // If the access token is expired, the fetch wrapper in _layout.tsx
        // will intercept the 401 and transparently refresh before retrying.
        const profile = (await authMe()).data;
        setUser(profile?.user);
      } catch {
        captureEvent(AnalyticsEvent.AuthFailedToRefresh);
        // No redirect: a first launch has no session to lose, and the app
        // layout already sends an unauthenticated visitor to onboarding.
        await clearSession();
      } finally {
        setIsLoading(false);
      }
    })();
  }, [clearSession, getAccessToken]);

  useEffect(() => {
    let cancelled = false;
    run(async () => {
      try {
        const resp = await appHealthCheck();
        if (!cancelled) {
          setCanConnectToServer(resp.response.ok);
        }
      } catch {
        if (!cancelled) {
          setCanConnectToServer(false);
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const startSession = useCallback(
    async (tokens: SessionTokensDto) => {
      queryClient.clear();

      const opened = await openSession({
        tokens,
        saveTokens,
        clearTokens: clearTokensAndReport,
      });
      if (!opened.ok) {
        throw opened.error;
      }

      const user = opened.value;
      setUser(user);
      posthog?.identify(user.id.toString(), {
        email: user.email,
        name: user.name,
      });
    },
    [saveTokens, clearTokensAndReport, posthog, queryClient],
  );

  const login = useCallback(
    async ({ email, password, navigateOnSuccess = true }: LoginParams) => {
      setIsLoading(true);
      try {
        const guestToken = (await getStoredGuestToken()) ?? undefined;
        const response = await authLogin({
          body: { email, password, mode: "header", guestToken },
        });
        if (guestToken) {
          await clearGuestToken();
        }

        const { access_token, refresh_token } = response.data ?? {};
        if (response.error || !access_token || !refresh_token) {
          throw new Error("Login failed");
        }

        await startSession({ access_token, refresh_token });

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
    logout,
    refreshUser,
    canConnectToServer,
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
