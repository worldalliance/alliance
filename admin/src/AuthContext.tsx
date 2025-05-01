import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  actionsFindAll,
  authAdminLogin,
  authRefreshTokens,
  appHealthCheck,
  ProfileDto,
} from "./client";
import { client } from "./client/client.gen";
import { getApiUrl } from "./config";

interface AuthContextType {
  isAuthenticated: boolean;
  user: ProfileDto | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
  isServerRunning: boolean;
  checkServerStatus: () => Promise<boolean>;
}

// Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<ProfileDto | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isServerRunning, setIsServerRunning] = useState<boolean>(true);
  const navigate = useNavigate();

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("refresh_token");

    navigate("/login");
    setUser(null);
  }, [navigate]);

  const checkServerStatus = async (): Promise<boolean> => {
    try {
      const response = await appHealthCheck();
      const serverRunning = !response.error;
      setIsServerRunning(serverRunning);
      return serverRunning;
    } catch (error) {
      console.error("Server health check failed:", error);
      setIsServerRunning(false);
      return false;
    }
  };

  // Check if user is authenticated on mount
  useEffect(() => {
    const checkAuth = async () => {
      // First check if the server is running
      const serverRunning = await checkServerStatus();
      if (!serverRunning) {
        setLoading(false);
        return;
      }

      const token = localStorage.getItem("token");
      const refreshToken = localStorage.getItem("refresh_token");

      console.log("token: ", token);
      console.log("refreshToken: ", refreshToken);

      if (token) {
        const actions = await actionsFindAll();
        if (actions.error) {
          localStorage.removeItem("token");

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
          } else {
            console.log("refresh token failed: logging out");
            logout();
          }
        }
      }

      setLoading(false);
    };

    checkAuth();
  }, [logout]);

  const login = async (email: string, password: string) => {
    setLoading(true);
    console.log("logging in");
    try {
      // Check server status before attempting to login
      const serverRunning = await checkServerStatus();
      if (!serverRunning) {
        throw new Error("Server not running");
      }

      const response = await authAdminLogin({
        body: { email, password },
      });
      if (response.data) {
        localStorage.setItem("token", response.data.access_token);
        localStorage.setItem("refresh_token", response.data.refresh_token);

        console.log("got response: ", response);

        navigate("/");
      }
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const value = {
    isAuthenticated: !!user,
    user,
    login,
    logout,
    loading,
    isServerRunning,
    checkServerStatus,
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
