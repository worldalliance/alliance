/**
 * Sign up data structure
 */
export interface SignUpData {
  name: string;
  email: string;
  password: string;
}

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