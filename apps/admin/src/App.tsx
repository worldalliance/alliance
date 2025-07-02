import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";
import LoginPage from "./LoginPage";
import DatabaseViewer from "./DatabaseViewer";
import { getApiUrl } from "./config";
import { client } from "@alliance/shared/client/client.gen";
import AdminPanel from "./AdminPanel";

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isAuthenticated, loading } = useAuth();

  console.log("isAuthenticated", isAuthenticated);

  if (!isAuthenticated && !loading) {
    return <Navigate to="/login" />;
  }

  return <>{children}</>;
};

const LoggedOutOnlyRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) {
    return <Navigate to="/" />;
  }

  return <>{children}</>;
};

client.setConfig({
  baseUrl: getApiUrl(),
  credentials: "include",
});

// AppRoutes component to use the auth context
const AppRoutes = () => {
  return (
    <>
      <Routes>
        <Route
          path="/login"
          element={
            <LoggedOutOnlyRoute>
              <LoginPage />
            </LoggedOutOnlyRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AdminPanel />
            </ProtectedRoute>
          }
        />
        <Route
          path="/database"
          element={
            <ProtectedRoute>
              <DatabaseViewer />
            </ProtectedRoute>
          }
        />
      </Routes>
    </>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
