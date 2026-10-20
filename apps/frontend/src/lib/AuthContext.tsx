// AuthProvider.tsx
// eslint-disable-next-line api-client/named-hooks-only -- sign-in, sign-out and token refresh touch no cache
import {
  authLogin,
  authLogout,
  authRefreshTokens,
  UserDto,
} from "@alliance/shared/client";
import React, {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { deviceTimeZone } from "@alliance/shared/lib/timeZone";
import { useBackfillTimeZone } from "@alliance/shared/lib/useBackfillTimeZone";
import { useMe } from "@alliance/shared/lib/useMe";
import { ViewerAuthenticationProvider } from "@alliance/sharedweb/ui/ViewerAuthenticationProvider";
import posthog from "posthog-js";
import { testAuthUser } from "../stories/testData";

export interface AuthContextType {
  isAuthenticated: boolean;
  user: UserDto | undefined;
  isImpersonation: boolean;
  refreshUser: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  onLogin: () => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);

export const AuthProvider: React.FC<React.PropsWithChildren> = memo(
  ({ children }: React.PropsWithChildren) => {
    const {
      me,
      fetch: fetchMe,
      refresh: refreshUser,
      startSession,
      clear: clearCache,
    } = useMe();
    const user = me?.user;
    const isImpersonation = me?.isImpersonation ?? false;
    const [loading, setLoading] = useState(true);

    useBackfillTimeZone(user, {
      detect: deviceTimeZone,
      enabled: !isImpersonation,
    });

    useEffect(() => {
      if (import.meta.env.PROD) {
        if (isImpersonation) {
          posthog.opt_out_capturing();
        } else if (user && user.id) {
          posthog.opt_in_capturing();
          posthog.identify(user.id.toString(), {
            email: user.email,
            name: user.name,
          });
        }
      }
    }, [user, isImpersonation]);

    useEffect(() => {
      let cancelled = false;

      const bootstrap = async () => {
        try {
          await fetchMe();
          if (cancelled) {
            return;
          }
        } catch {
          try {
            await authRefreshTokens();
            if (cancelled) return;
            await fetchMe();
            if (cancelled) {
              return;
            }
          } catch {
            console.log("AuthContext", "refresh failed");
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      };

      bootstrap();
      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const login = useCallback(
      async (email: string, password: string) => {
        setLoading(true);
        const { error } = await authLogin({
          body: { email, password, mode: "cookie" },
        });
        if (error) {
          console.error("login error", error);
          throw new Error("Login failed");
        }

        await startSession();
        setLoading(false);
      },
      [startSession],
    );

    const logout = useCallback(async () => {
      await authLogout();
      clearCache();
      posthog.reset();
      window.location.href = "/login";
    }, [clearCache]);

    const onLogin = useCallback(async () => {
      await startSession();
    }, [startSession]);

    const value = useMemo<AuthContextType>(
      () => ({
        isAuthenticated: !!user,
        user,
        isImpersonation,
        login,
        onLogin,
        refreshUser,
        logout,
        loading,
      }),
      [user, isImpersonation, loading, login, logout, onLogin, refreshUser],
    );

    return (
      <AuthContext.Provider value={value}>
        <ViewerAuthenticationProvider isAuthenticated={value.isAuthenticated}>
          {children}
        </ViewerAuthenticationProvider>
      </AuthContext.Provider>
    );
  },
);

AuthProvider.displayName = "AuthProvider";

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);

  if (import.meta.env.STORYBOOK) {
    return {
      isAuthenticated: true,
      user: testAuthUser,
      isImpersonation: false,
      login: () => Promise.resolve(),
      onLogin: () => Promise.resolve(),
      logout: () => Promise.resolve(),
      refreshUser: () => Promise.resolve(),
      loading: false,
    };
  }
  if (!ctx) {
    if (import.meta.env.PROD) {
      throw new Error("useAuth must be used within an AuthProvider");
    }
    return {
      isAuthenticated: false,
      user: undefined,
      isImpersonation: false,
      login: () => Promise.resolve(),
      onLogin: () => Promise.resolve(),
      logout: () => Promise.resolve(),
      refreshUser: () => Promise.resolve(),
      loading: false,
    };
  }
  return ctx;
};
