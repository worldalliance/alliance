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
import AccountPage from "./pages/app/AccountPage";
import ActionsListPage from "./pages/app/ActionsListPage";
import { getApiUrl, isFeatureEnabled } from "./lib/config";
import NewLandingPage from "./pages/static/NewLandingPage";
import PrelaunchLandingPage from "./pages/static/PrelaunchLanding";
import AnnouncementListPage from "./pages/app/AnnouncementListPage";
import AnnouncementEditPage from "./pages/app/AnnouncementEditPage";
import AnnouncementPage from "./pages/app/AnnouncementPage";
import ForumPage from "./pages/app/ForumPage";
import PostDetailPage from "./pages/app/PostDetailPage";
import PostFormPage from "./pages/app/PostFormPage";
import AboutPage from "./pages/static/AboutPage";
import UserProfilePage from "./pages/app/UserProfilePage";
import { client } from "../../../shared/client/client.gen";
import { AuthProvider, useAuth } from "./lib/AuthContext";
import TempProdPassword from "./TempProdPassword";
import { Features } from "@alliance/shared/lib/features";
import ProfilePageEdit from "./pages/app/ProfilePageEdit";

client.setConfig({
  baseUrl: getApiUrl(),
  credentials: "include",
});

// A simple auth check component
const ProtectedRoute: React.FC<React.PropsWithChildren> = ({
  children,
}: React.PropsWithChildren) => {
  const { isAuthenticated, loading } = useAuth();
  if (!isAuthenticated && !loading) {
    return <Navigate to="/login" />;
  }
  return (
    <>
      <Navbar currentPage={NavbarPage.Dashboard} format="horizontal" />
      {children}
    </>
  );
};

const PublicAppRoute: React.FC<React.PropsWithChildren> = ({
  children,
}: React.PropsWithChildren) => {
  const { isAuthenticated } = useAuth();

  return (
    <>
      {isAuthenticated && (
        <Navbar currentPage={NavbarPage.Dashboard} format="horizontal" />
      )}
      {children}
    </>
  );
};

const LoggedOutOnlyRoute: React.FC<React.PropsWithChildren> = ({
  children,
}: React.PropsWithChildren) => {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) {
    return <Navigate to="/home" />;
  }

  return <>{children}</>;
};

// AppRoutes component to use the auth context
const AppRoutes = () => {
  const { user } = useAuth();
  return (
    <>
      <Routes>
        <Route path="/" element={<PrelaunchLandingPage />} />
        <Route path="/landing" element={<NewLandingPage />} />
        <Route path="/about" element={<AboutPage />} />
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
            <PublicAppRoute>
              <ActionPage />
            </PublicAppRoute>
          }
        />
        <Route path="/issues" element={<IssuesListPage />} />
        <Route path="/issues/:issue" element={<IssuePage />} />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Navigate to={`/user/${user?.id}`} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/editprofile"
          element={
            <ProtectedRoute>
              <ProfilePageEdit />
            </ProtectedRoute>
          }
        />
        <Route path="/user/:id" element={<UserProfilePage />} />
        <Route
          path="/actions"
          element={
            <PublicAppRoute>
              <ActionsListPage />
            </PublicAppRoute>
          }
        />
        <Route
          path="/announcements"
          element={
            <PublicAppRoute>
              <AnnouncementListPage />
            </PublicAppRoute>
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
          path="/settings"
          element={
            <ProtectedRoute>
              <AccountPage />
            </ProtectedRoute>
          }
        />
        <Route path="/announcements/:id" element={<AnnouncementPage />} />
        {isFeatureEnabled(Features.Forum) && (
          <>
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
          </>
        )}
      </Routes>
    </>
  );
};

function App() {
  return (
    <Router>
      <TempProdPassword>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </TempProdPassword>
    </Router>
  );
}

export default App;
