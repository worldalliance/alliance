import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./AuthContext";
import LoginPage from "./LoginPage";
import AdminActionPage from "./AdminActionPage";
import { getApiUrl } from "./config";
import { client } from "./client/client.gen";
import AdminPanel from "./AdminPanel";

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const isAuthenticated = localStorage.getItem("token") !== null;

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  return <>{children}</>;
};

const LoggedOutOnlyRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const isAuthenticated = localStorage.getItem("token") !== null;
  if (isAuthenticated) {
    return <Navigate to="/" />;
  }

  return <>{children}</>;
};

client.setConfig({
  baseUrl: getApiUrl(),
  headers: {
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  },
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
          path="/action/:id"
          element={
            <ProtectedRoute>
              <AdminActionPage />
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
