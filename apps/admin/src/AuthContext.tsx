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
  authLogout,
  authMe,
  authRefreshTokens,
  UserDto,
} from "@alliance/shared/client";
import { authAdminLogin } from "@alliance/shared/client";

interface AuthContextType {
  isAuthenticated: boolean;
  user: UserDto | undefined;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<React.PropsWithChildren> = memo(
  ({ children }) => {
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
            if (data && !cancelled) {
              setUser(data);
            }
          } catch (error) {
            console.log("AuthContext", "refresh failed", error);
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
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
      try {
        const { error } = await authAdminLogin({
          body: { email, password, mode: "cookie" },
        });
        if (error) {
          console.error("login error", error);
          throw new Error("Login failed");
        }

        const { data } = await authMe();
        if (data) {
          setUser(data);
        } else {
          throw new Error("Failed to get user data after login");
        }
      } finally {
        setLoading(false);
      }
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

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (import.meta.env.STORYBOOK) {
    return {
      isAuthenticated: true,
      user: undefined,
      login: () => Promise.resolve(),
      logout: () => Promise.resolve(),
      loading: false,
    };
  }
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};
