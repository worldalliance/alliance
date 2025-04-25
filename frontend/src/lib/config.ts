/**
 * Configuration for API endpoints based on environment
 */

// Get API URL from environment or use defaults
export const getApiUrl = (): string => {
  // Check for environment variables first
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }

  // Otherwise, determine based on NODE_ENV
  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3005"; // Local development
  } else {
    // Use EC2 subnet from terraform config
    return "http://10.0.4.0:3001";
  }
};

// API configuration object
export const apiConfig = {
  baseUrl: getApiUrl(),
  endpoints: {
    login: "/auth/login",
    register: "/auth/register",
    profile: "/auth/me",
  },
};
