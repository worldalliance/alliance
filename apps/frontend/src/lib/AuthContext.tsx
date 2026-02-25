// AuthProvider.tsx
import {
  authLogin,
  authLogout,
  authMe,
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

import posthog from "posthog-js";
import { testAuthUser } from "../stories/testData";

interface AuthContextType {
  isAuthenticated: boolean;
  user: UserDto | undefined;
  isImpersonation: boolean;
  refreshUser: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  onLogin: () => void;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<React.PropsWithChildren> = memo(
  ({ children }: React.PropsWithChildren) => {
    const [user, setUser] = useState<UserDto | undefined>();
    const [isImpersonation, setIsImpersonation] = useState(false);
    const [loading, setLoading] = useState(true);

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
          const { data } = await authMe();
          if (data) {
            if (!cancelled) {
              setUser(data.user);
              setIsImpersonation(data.isImpersonation ?? false);
            }
          } else {
            throw new Error("No user data");
          }
        } catch {
          try {
            await authRefreshTokens();

            const { data } = await authMe();
            if (!cancelled && data) {
              setUser(data.user);
              setIsImpersonation(data.isImpersonation ?? false);
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
    }, []);

    // ---------- actions ----------
    const login = useCallback(async (email: string, password: string) => {
      setLoading(true);
      const { error } = await authLogin({
        body: { email, password, mode: "cookie" },
      });
      if (error) {
        console.error("login error", error);
        throw new Error("Login failed");
      }

      const { data } = await authMe();
      if (data) {
        setUser(data.user);
        setIsImpersonation(data.isImpersonation ?? false);
      }
      setLoading(false);
    }, []);

    const logout = useCallback(async () => {
      await authLogout();
      window.location.href = "/login";
      posthog.reset();
      setUser(undefined);
    }, []);

    const onLogin = useCallback(() => {
      authMe().then((res) => {
        if (res.data) {
          setUser(res.data.user);
          setIsImpersonation(res.data.isImpersonation ?? false);
        }
      });
    }, []);

    const refreshUser = useCallback(async () => {
      const { data } = await authMe();
      if (data) {
        setUser(data.user);
        setIsImpersonation(data.isImpersonation ?? false);
      }
    }, []);

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
      [user, isImpersonation, loading, login, logout, onLogin, refreshUser]
    );

    return (
      <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
  }
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
      onLogin: () => {},
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
      onLogin: () => {},
      logout: () => Promise.resolve(),
      refreshUser: () => Promise.resolve(),
      loading: false,
    };
  }
  return ctx;
};
