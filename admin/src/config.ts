// Get API URL from environment or use defaults
export const getApiUrl = (): string => {
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }

  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3005"; // Local development
  } else {
    return "http://alliance-beta.xyz:3005";
  }
};

export const apiConfig = {
  baseUrl: getApiUrl(),
  endpoints: {
    login: "/auth/login",
    register: "/auth/register",
    profile: "/auth/me",
    actions: "/actions",
    action: (id: number) => `/actions/${id}`,
  },
};
