import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { useNavigate } from "react-router-dom";
import { authApi } from "./authapi";
import { fetchActions } from "./actionsapi";

interface UserData {
  name: string;
  email: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: UserData | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const navigate = useNavigate();

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("refresh_token");

    navigate("/login");
    setUser(null);
  }, [navigate]);

  // Check if user is authenticated on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("token");
      const refreshToken = localStorage.getItem("refresh_token");

      console.log("token: ", token);
      console.log("refreshToken: ", refreshToken);

      if (token) {
        const actions = await fetchActions();
        if (actions === "unauthorized") {
          localStorage.removeItem("token");

          if (refreshToken) {
            const response = await authApi.refreshAccessToken(refreshToken);
            if (response) {
              localStorage.setItem("token", response.access_token);
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
  }, [logout]);

  const login = async (email: string, password: string) => {
    setLoading(true);
    console.log("logging in");
    try {
      const response = await authApi.login({ email, password });
      localStorage.setItem("token", response.access_token);
      localStorage.setItem("refresh_token", response.refresh_token);

      console.log("got response: ", response);

      navigate("/");
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
