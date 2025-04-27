import { apiConfig } from "./config";

export interface Action {
  id: number;
  name: string;
  category: string;
  whyJoin: string;
  description: string;
  status: string;
  createdAt: Date;
}

/**
 * API client for actions
 */
export const actionsApi = {
  /**
   * Get all actions
   */
  async getAllActions(): Promise<Action[]> {
    const token = localStorage.getItem("token");

    if (!token) {
      throw new Error("Authentication required");
    }

    const response = await fetch(`${apiConfig.baseUrl}/actions`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch actions");
    }

    return await response.json();
  },

  /**
   * Get action by ID
   */
  async getActionById(id: number): Promise<Action> {
    const token = localStorage.getItem("token");

    if (!token) {
      throw new Error("Authentication required");
    }

    const response = await fetch(`${apiConfig.baseUrl}/actions/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch action with ID ${id}`);
    }

    return await response.json();
  },

  /**
   * Join an action
   */
  async joinAction(id: number): Promise<any> {
    const token = localStorage.getItem("token");

    if (!token) {
      throw new Error("Authentication required");
    }

    const response = await fetch(`${apiConfig.baseUrl}/actions/${id}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to join action with ID ${id}`);
    }

    return await response.json();
  },
};
