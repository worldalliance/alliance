import { getApiUrl } from "./config";

export interface Action {
  id: number;
  name: string;
  category: string;
  whyJoin: string;
  description: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateActionDto {
  name: string;
  category: string;
  whyJoin: string;
  description: string;
  status: string;
}

export interface UpdateActionDto {
  name?: string;
  category?: string;
  whyJoin?: string;
  description?: string;
  status?: string;
}

const API_URL = getApiUrl();

export const fetchActions = async (): Promise<Action[]> => {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("No authentication token");
  }

  const response = await fetch(`${API_URL}/actions`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch actions");
  }

  return await response.json();
};

export const fetchAction = async (id: number): Promise<Action> => {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("No authentication token");
  }

  const response = await fetch(`${API_URL}/actions/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch action");
  }

  return await response.json();
};

export const createAction = async (data: CreateActionDto): Promise<Action> => {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("No authentication token");
  }

  const response = await fetch(`${API_URL}/actions/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error("Failed to create action");
  }

  return await response.json();
};

export const updateAction = async (
  id: number,
  data: UpdateActionDto
): Promise<Action> => {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("No authentication token");
  }

  const response = await fetch(`${API_URL}/actions/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error("Failed to update action");
  }

  return await response.json();
};

export const deleteAction = async (id: number): Promise<void> => {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("No authentication token");
  }

  const response = await fetch(`${API_URL}/actions/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to delete action");
  }
};
