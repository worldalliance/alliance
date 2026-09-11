import type { AuthContextType } from "../lib/AuthContext";

const noop = () => Promise.resolve();

const loggedOut: AuthContextType = {
  isAuthenticated: false,
  user: undefined,
  isImpersonation: false,
  refreshUser: noop,
  setUser: () => {},
  login: noop,
  onLogin: noop,
  logout: noop,
  loading: false,
};

export const authValue = (
  overrides: Partial<Omit<AuthContextType, "isAuthenticated">> = {},
): AuthContextType => ({
  ...loggedOut,
  ...overrides,
  isAuthenticated: !!overrides.user,
});
