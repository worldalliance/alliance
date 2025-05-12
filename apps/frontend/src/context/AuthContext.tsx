import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  authLogin,
  authMe,
  authRefreshTokens,
  ProfileDto,
} from "../../../../shared/client";
import { getApiUrl } from "../lib/config";
import { client } from "../../../../shared/client/client.gen";

interface AuthContextType {
  isAuthenticated: boolean;
  user: ProfileDto | undefined;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<ProfileDto | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(true);
  const navigate = useNavigate();

  // Check if user is authenticated on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("token");

      const refreshToken = localStorage.getItem("refresh_token");

      if (token) {
        try {
          const userProfile = await authMe();
          setUser(userProfile.data);

          if (userProfile.error) {
            throw new Error("User profile not found");
          }

          console.log("user profile: ", userProfile);
        } catch (error) {
          console.log("trying to refresh token");
          localStorage.removeItem("token");

          if (refreshToken) {
            const response = await authRefreshTokens({
              headers: {
                Authorization: `Bearer ${refreshToken}`,
              },
            });

            if (response.data) {
              localStorage.setItem("token", response.data.access_token);

              client.setConfig({
                baseUrl: getApiUrl(),
                headers: {
                  Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
              });

              const userProfile = (await authMe()).data;
              setUser(userProfile);
            } else {
              console.log("refresh token failed: logging out");
              logout();
            }
          }
        }
      }

      setLoading(false);
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    console.log("logging in");
    try {
      const response = await authLogin({
        body: { email, password },
      });
      console.log("got response: ", response);
      if (response.data) {
        console.log("setting tokens: ", response.data.access_token);
        localStorage.setItem("token", response.data.access_token);
        localStorage.setItem("refresh_token", response.data.refresh_token);
        console.log("got response: ", response);
      } else {
        throw new Error("Login failed");
      }

      const userProfile = await authMe();
      if (userProfile.data) {
        setUser(userProfile.data);
      }

      navigate("/home");
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("refresh_token");

    navigate("/login");
    setUser(undefined);
  };

  const value = {
    isAuthenticated: !!user,
    user,
    login,
    logout,
    loading,
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
