import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import HomePage from "./pages/HomePage";
import IssuesListPage from "./pages/IssuesListPage";
import IssuePage from "./pages/IssuePage";
import Navbar, { NavbarPage } from "./components/Navbar";
import ActionPage from "./pages/ActionPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import { AuthProvider, useAuth } from "./context/AuthContext";
import AccountPage from "./pages/AccountPage";
import ActionsListPage from "./pages/ActionsListPage";

// A simple auth check component
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
    return <Navigate to="/home" />;
  }

  return <>{children}</>;
};

// AppRoutes component to use the auth context
const AppRoutes = () => {
  const { isAuthenticated } = useAuth();

  return (
    <>
      {isAuthenticated && (
        <Navbar currentPage={NavbarPage.Dashboard} format="horizontal" />
      )}
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route
          path="/login"
          element={
            <LoggedOutOnlyRoute>
              <LoginPage />
            </LoggedOutOnlyRoute>
          }
        />
        <Route
          path="/signup"
          element={
            <LoggedOutOnlyRoute>
              <SignupPage />
            </LoggedOutOnlyRoute>
          }
        />
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/action/:id"
          element={
            <ProtectedRoute>
              <ActionPage state="uncommitted" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/issues"
          element={
            <ProtectedRoute>
              <IssuesListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/issues/:issue"
          element={
            <ProtectedRoute>
              <IssuePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/account"
          element={
            <ProtectedRoute>
              <AccountPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/actions"
          element={
            <ProtectedRoute>
              <ActionsListPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </>
  );
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}

export default App;
