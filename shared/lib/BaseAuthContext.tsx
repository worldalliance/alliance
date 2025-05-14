import React, { createContext, useContext, useState, useEffect } from "react";
import {
  authLogin,
  authLogout,
  authMe,
  authRefreshTokens,
  ProfileDto,
} from "../client";

interface AuthContextType {
  isAuthenticated: boolean;
  user: ProfileDto | undefined;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export interface BaseAuthProviderProps extends React.PropsWithChildren {
  navigateOnLogin: () => void;
  navigateOnLogout: () => void;
}

export const BaseAuthProvider: React.FC<BaseAuthProviderProps> = ({
  children,
  navigateOnLogin,
  navigateOnLogout,
}) => {
  const [user, setUser] = useState<ProfileDto | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    (async () => {
      try {
        const profile = (await authMe()).data;
        console.log("got profile: ", profile);
        setUser(profile);
      } catch {
        // attempt silent refresh, then retry once
        try {
          console.log("attempting silent refresh");
          await authRefreshTokens(); // cookie is sent automatically
          const profile = (await authMe()).data;
          setUser(profile);
        } catch {
          logout();
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    console.log("logging in");
    try {
      const response = await authLogin({
        body: { email, password },
      });
      console.log("got response: ", response);
      if (response.error) {
        throw new Error("Login failed");
      }

      const userProfile = await authMe();
      if (userProfile.data) {
        setUser(userProfile.data);
      }

      navigateOnLogin();
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    navigateOnLogout();
    authLogout();
    setUser(undefined);
  };

  const value: AuthContextType = {
    isAuthenticated: !!user || loading,
    user,
    login,
    logout,
    loading,
  };

  console.log("value: ", value);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
};
