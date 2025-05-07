import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import HomePage from "./pages/app/HomePage";
import IssuesListPage from "./pages/app/IssuesListPage";
import IssuePage from "./pages/app/IssuePage";
import Navbar, { NavbarPage } from "./components/Navbar";
import ActionPage from "./pages/app/ActionPage";
import LoginPage from "./pages/app/LoginPage";
import SignupPage from "./pages/app/SignupPage";
import { AuthProvider } from "./context/AuthContext";
import AccountPage from "./pages/app/AccountPage";
import ActionsListPage from "./pages/app/ActionsListPage";
import { client } from "./client/client.gen";
import { getApiUrl } from "./lib/config";
import NewLandingPage from "./pages/static/NewLandingPage";
import AnnouncementListPage from "./pages/app/AnnouncementListPage";
import AnnouncementEditPage from "./pages/app/AnnouncementEditPage";
import AnnouncementPage from "./pages/app/AnnouncementPage";
import ForumPage from "./pages/app/ForumPage";
import PostDetailPage from "./pages/app/PostDetailPage";
import PostFormPage from "./pages/app/PostFormPage";
import AboutPage from "./pages/static/AboutPage";

// A simple auth check component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const isAuthenticated = localStorage.getItem("token") !== null;

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  return (
    <>
      <Navbar currentPage={NavbarPage.Dashboard} format="horizontal" />
      {children}
    </>
  );
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
        <Route path="/" element={<NewLandingPage />} />
        <Route path="/platform" element={<AboutPage />} />
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
              <ActionPage />
            </ProtectedRoute>
          }
        />
        <Route path="/issues" element={<IssuesListPage />} />
        <Route path="/issues/:issue" element={<IssuePage />} />
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
        <Route
          path="/announcements"
          element={
            <ProtectedRoute>
              <AnnouncementListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/announcements/new"
          element={
            <ProtectedRoute>
              <AnnouncementEditPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/announcements/edit/:id"
          element={
            <ProtectedRoute>
              <AnnouncementEditPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/announcements/:id"
          element={
            <ProtectedRoute>
              <AnnouncementPage />
            </ProtectedRoute>
          }
        />
        {/* Forum Routes */}
        <Route
          path="/forum"
          element={
            <ProtectedRoute>
              <ForumPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/forum/post/:postId"
          element={
            <ProtectedRoute>
              <PostDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/forum/new"
          element={
            <ProtectedRoute>
              <PostFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/forum/edit/:postId"
          element={
            <ProtectedRoute>
              <PostFormPage />
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
