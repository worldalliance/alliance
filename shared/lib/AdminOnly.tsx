import React from "react";
import { useAuth } from "./BaseAuthContext";
export const AdminOnly: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { user } = useAuth();
  return user?.admin ? children : null;
};
