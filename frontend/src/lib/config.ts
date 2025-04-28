/**
 * Configuration for API endpoints based on environment
 */

// Get API URL from environment or use defaults
export const getApiUrl = (): string => {
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }

  if (process.env.NODE_ENV === "development") {
    return "https://localhost:3005"; // Local development
  } else {
    return "https://alliance-beta.xyz/api";
  }
};

// API configuration object
export const apiConfig = {
  baseUrl: getApiUrl(),
  endpoints: {
    login: "/auth/login",
    register: "/auth/register",
    profile: "/auth/me",
    refresh: "/auth/refresh",
    actions: "/actions",
    action: (id: number) => `/actions/${id}`,
  },
};
