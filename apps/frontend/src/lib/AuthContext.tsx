// AuthProvider.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  memo,
} from "react";
import {
  authLogin,
  authLogout,
  authMe,
  authRefreshTokens,
  UserDto,
} from "@alliance/shared/client";

import { testAuthUser } from "../stories/testData";

interface AuthContextType {
  isAuthenticated: boolean;
  user: UserDto | undefined;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<React.PropsWithChildren> = memo(
  ({ children }: React.PropsWithChildren) => {
    const [user, setUser] = useState<UserDto | undefined>();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      let cancelled = false;

      const bootstrap = async () => {
        try {
          const { data } = await authMe();
          if (data) {
            if (!cancelled) setUser(data);
          } else {
            throw new Error("No user data");
          }
        } catch {
          try {
            await authRefreshTokens();
            const { data } = await authMe();
            if (!cancelled) setUser(data);
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
      setUser(data);
      setLoading(false);
    }, []);

    const logout = useCallback(async () => {
      await authLogout();
      setUser(undefined);
    }, []);

    const value = useMemo<AuthContextType>(
      () => ({
        isAuthenticated: !!user,
        user,
        login,
        logout,
        loading,
      }),
      [user, loading, login, logout]
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
      login: () => Promise.resolve(),
      logout: () => Promise.resolve(),
      loading: false,
    };
  }
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};
