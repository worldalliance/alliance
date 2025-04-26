import { apiConfig } from "./config";

/**
 * Login data structure
 */
export interface LoginData {
  email: string;
  password: string;
}

/**
 * Authentication response from server
 */
export interface AuthResponse {
  access_token: string;
}

/**
 * API client for authentication
 */
export const authApi = {
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
};
