import { AnalyticsEvent } from "@alliance/common/analytics";
import { errorMessage } from "@alliance/common/errorMessage";
import {
  OAUTH_PROVIDER_LABEL,
  OAuthIntent,
  type OAuthOutcome,
  oauthOutcomeSchema,
  type OAuthProvider,
} from "@alliance/common/oauth";
import { run } from "@alliance/common/run";
import { client } from "@alliance/shared/client/client.gen";
import { captureEvent } from "@alliance/shared/lib/analytics";
import { deviceTimeZone } from "@alliance/shared/lib/timeZone";
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
import {
  appHealthCheck,
  authLogin,
  authLogout,
  authMe,
  oAuthExchange,
  oAuthNativeSignIn,
  UserDto,
} from "../../../shared/client";
import { clearGuestToken, getStoredGuestToken } from "./guestSession";
import { OAuthSignInError, signInWith } from "./oauth";
import { SecureStorage, SecureStorageKey } from "./SecureStorage";
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
  /** Resolves once signed in, with what the provider turned out to be doing. */
  loginWithProvider: (params: {
    provider: OAuthProvider;
    referralCode?: string | null;
    navigateOnSuccess?: boolean;
  }) => Promise<OAuthOutcome>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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

  const clearTokens = useCallback(async () => {
    await Promise.all([
      SecureStorage.deleteItem(SecureStorageKey.ACCESS_TOKEN),
      SecureStorage.deleteItem(SecureStorageKey.REFRESH_TOKEN),
    ]);
  }, []);

  const getAccessToken = useCallback(async () => {
    return await SecureStorage.getItem(SecureStorageKey.ACCESS_TOKEN);
  }, []);
  const clearSession = useCallback(() => {
    authLogout();
    clearTokens();
    queryClient.clear();
    setUser(undefined);
  }, [clearTokens, queryClient]);

  const logout = useCallback(() => {
    clearSession();
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
          client.setConfig({
            ...client.getConfig(),
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });
        }
        // If the access token is expired, the fetch wrapper in _layout.tsx
        // will intercept the 401 and transparently refresh before retrying.
        const profile = (await authMe()).data;
        setUser(profile?.user);
      } catch {
        captureEvent(AnalyticsEvent.AuthFailedToRefresh);
        // No redirect: a first launch has no session to lose, and the app
        // layout already sends an unauthenticated visitor to onboarding.
        clearSession();
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

  const completeSignIn = useCallback(
    async (params: {
      tokens: { access_token?: string; refresh_token?: string };
      navigateOnSuccess: boolean;
    }) => {
      const { access_token, refresh_token } = params.tokens;
      if (!access_token || !refresh_token) {
        throw new Error("didn't receive tokens: something went wrong");
      }

      client.setConfig({
        ...client.getConfig(),
        headers: { Authorization: `Bearer ${access_token}` },
      });
      await saveTokens(access_token, refresh_token);
      queryClient.clear();

      const userProfile = await authMe();
      if (!userProfile.data) {
        throw new Error("Failed to fetch user profile");
      }

      const user = userProfile.data.user;
      setUser(user);
      posthog?.identify(user.id.toString(), {
        email: user.email,
        name: user.name,
      });

      if (!isVisualTestMode && params.navigateOnSuccess) {
        router.replace("/");
      }
    },
    [router, saveTokens, posthog, queryClient],
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

        if (response.error || !response.data) {
          throw new Error("Login failed");
        }

        await completeSignIn({ tokens: response.data, navigateOnSuccess });
      } finally {
        setIsLoading(false);
      }
    },
    [completeSignIn],
  );

  /**
   * The SDKs hand the app a token the server verifies; the browser flow hands
   * it a deep link worth nothing without the secret from the start call. Either
   * way the app trades what it has for a session of its own.
   */
  const loginWithProvider = useCallback(
    async ({
      provider,
      referralCode,
      navigateOnSuccess = true,
    }: {
      provider: OAuthProvider;
      referralCode?: string | null;
      navigateOnSuccess?: boolean;
    }) => {
      const result = await signInWith({
        provider,
        intent: OAuthIntent.Authenticate,
        referralCode,
      });
      if (!result.ok) {
        throw new OAuthSignInError(provider, result.error);
      }
      const signIn = result.value;

      setIsLoading(true);
      try {
        const guestToken = (await getStoredGuestToken()) ?? undefined;
        const unwrapTokens = <T,>(response: {
          data?: T;
          error?: unknown;
        }): T => {
          if (response.error || !response.data) {
            throw new Error(
              errorMessage({
                error: response.error,
                fallback: `${OAUTH_PROVIDER_LABEL[provider]} sign-in failed`,
              }),
            );
          }
          return response.data;
        };
        const session =
          signIn.kind === "native"
            ? await oAuthNativeSignIn({
                path: { provider },
                body: {
                  identityToken: signIn.identityToken,
                  name: signIn.name ?? undefined,
                  referralCode: referralCode ?? undefined,
                  timeZone: deviceTimeZone(),
                  mode: "header",
                  guestToken,
                },
              }).then((response) => {
                const tokens = unwrapTokens(response);
                return {
                  tokens,
                  outcome: oauthOutcomeSchema.parse(tokens.outcome),
                };
              })
            : await oAuthExchange({
                path: { provider },
                body: {
                  handoff: signIn.handoff,
                  proof: signIn.proof,
                  mode: "header",
                  guestToken,
                },
              }).then((response) => ({
                tokens: unwrapTokens(response),
                outcome: signIn.outcome,
              }));

        if (guestToken) {
          await clearGuestToken();
        }
        await completeSignIn({ tokens: session.tokens, navigateOnSuccess });
        return session.outcome;
      } finally {
        setIsLoading(false);
      }
    },
    [completeSignIn],
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
