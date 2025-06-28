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
            console.log("AuthContext", "refreshing tokens");
            const response = await authRefreshTokens();
            console.log("AuthContext", "refresh response", response);
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
      console.log("login", email, password);
      setLoading(true);
      try {
        const response = await authAdminLogin({
          body: { email, password, mode: "cookie" },
        });
        if (response.error) throw new Error("Login failed");
        console.log("login:", response.data);
        const { data } = await authMe(); // guaranteed by fresh cookie
        setUser(data);
      } finally {
        setLoading(false);
      }
    }, []);

    const logout = useCallback(async () => {
      await authLogout();
      setUser(undefined);
    }, []);

    console.log("user", user);

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
