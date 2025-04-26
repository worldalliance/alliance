import { SignUpData, LoginData, AuthResponse } from "../types/auth";
import { apiConfig } from "./config";

/**
 * API client for authentication
 */
export const authApi = {
  /**
   * Register a new user
   */
  async register(data: SignUpData): Promise<{ success: boolean }> {
    const response = await fetch(
      `${apiConfig.baseUrl}${apiConfig.endpoints.register}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Registration failed");
    }

    return await response.json();
  },

  /**
   * Login a user
   */
  async login(data: LoginData): Promise<AuthResponse> {
    const response = await fetch(
      `${apiConfig.baseUrl}${apiConfig.endpoints.login}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Login failed");
    }

    return await response.json();
  },

  /**
   * Get user profile (requires auth)
   */
  async getProfile(): Promise<any> {
    const token = localStorage.getItem("token");

    if (!token) {
      throw new Error("Authentication required");
    }

    const response = await fetch(
      `${apiConfig.baseUrl}${apiConfig.endpoints.profile}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch profile");
    }

    return await response.json();
  },
};
