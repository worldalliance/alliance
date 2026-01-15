import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import {
  authLogin,
  authLogout,
  authMe,
  authRefreshTokens,
  UserDto,
} from "../../../shared/client";
import { useRouter } from "expo-router";
import { client } from "@alliance/shared/client/client.gen";
import { getApiUrl } from "./config";

interface AuthContextType {
  isAuthenticated: boolean;
  user: UserDto | undefined;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const ACCESS_KEY = "accessToken";
const REFRESH_KEY = "refreshToken";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export interface AuthTokenStore {
  setItem: (key: string, value: string) => Promise<void>;
  getItem: (key: string) => Promise<string | null>;
  deleteItem: (key: string) => Promise<void>;
}

export const AuthProvider: React.FC<
  React.PropsWithChildren<{
    tokenStore: AuthTokenStore;
  }>
> = ({ children, tokenStore }) => {
  const [user, setUser] = useState<UserDto | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const router = useRouter();

  const saveTokens = useCallback(
    async (access: string, refresh: string) => {
      await tokenStore.setItem(ACCESS_KEY, access);
      await tokenStore.setItem(REFRESH_KEY, refresh);
    },
    [tokenStore]
  );

  const clearTokens = useCallback(async () => {
    await tokenStore.deleteItem(ACCESS_KEY);
    await tokenStore.deleteItem(REFRESH_KEY);
  }, [tokenStore]);

  const getAccessToken = useCallback(async () => {
    return await tokenStore.getItem(ACCESS_KEY);
  }, [tokenStore]);
  const getRefreshToken = useCallback(async () => {
    return await tokenStore.getItem(REFRESH_KEY);
  }, [tokenStore]);

  const logout = useCallback(async () => {
    authLogout();
    clearTokens();
    setUser(undefined);
    router.replace("/auth/login");
  }, [router, clearTokens]);

  const refreshAccessToken = useCallback(async () => {
    let accessToken = await getAccessToken();
    const refreshToken = await getRefreshToken();
    if (refreshToken) {
      try {
        client.setConfig({
          baseUrl: getApiUrl(),
          headers: {
            Authorization: `Bearer ${refreshToken}`,
          },
        });
        const response = await authRefreshTokens();
        if (response.data) {
          await saveTokens(response.data.access_token, refreshToken);
          accessToken = response.data.access_token;
        }
      } finally {
        client.setConfig({
          baseUrl: getApiUrl(),
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
      }
    }
  }, [getRefreshToken, getAccessToken, saveTokens]);

  useEffect(() => {
    (async () => {
      try {
        console.log("getting access token");
        const accessToken = await getAccessToken();
        console.log("got access token: ", accessToken);
        if (accessToken) {
          client.setConfig({
            baseUrl: getApiUrl(),
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });
        }
        const profile = (await authMe()).data;
        setUser(profile?.user);
      } catch {
        try {
          console.log("attempting silent refresh");
          await refreshAccessToken();

          const profile = (await authMe()).data;
          setUser(profile?.user);
        } catch {
          logout();
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, [logout, getAccessToken, getRefreshToken, refreshAccessToken]);

  const login = useCallback(
    async (email: string, password: string) => {
      setIsLoading(true);
      try {
        console.log("sending LOGIN request:");
        console.log({ email, password, mode: "header" });
        const response = await authLogin({
          body: { email, password, mode: "header" },
        });

        if (response.error || !response.data) {
          throw new Error("Login failed");
        }

        client.setConfig({
          baseUrl: getApiUrl(),
          headers: {
            Authorization: `Bearer ${response.data.access_token}`,
          },
        });

        if (response.data.access_token && response.data.refresh_token) {
          await saveTokens(
            response.data.access_token,
            response.data.refresh_token
          );
        } else {
          console.error("didn't recieve tokens: something went wrong");
        }

        const userProfile = await authMe();
        if (!userProfile.data) {
          throw new Error("Failed to fetch user profile");
        }

        setUser(userProfile.data?.user);

        router.replace("/");
      } catch (error) {
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [router, saveTokens]
  );

  useEffect(() => {
    if (
      __DEV__ &&
      process.env.EXPO_PUBLIC_DEV_AUTO_LOGIN === "true" &&
      process.env.EXPO_PUBLIC_DEV_EMAIL &&
      process.env.EXPO_PUBLIC_DEV_PASSWORD
    ) {
      login(
        process.env.EXPO_PUBLIC_DEV_EMAIL,
        process.env.EXPO_PUBLIC_DEV_PASSWORD
      )
        .then(() => {
          console.log("auto login successful");
        })
        .catch((error) => {
          console.error("auto login failed", error);
        });
    }
  }, [login]);

  const value: AuthContextType = {
    isAuthenticated: !!user,
    user,
    login,
    logout,
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
