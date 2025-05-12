import React from "react";
import { useAuth } from "./AuthContext";
export const AdminOnly: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { user } = useAuth();
  return user?.admin ? children : null;
};
