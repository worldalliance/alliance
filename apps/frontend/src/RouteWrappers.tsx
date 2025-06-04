import { NavbarPage } from "./components/Navbar";

import { Navigate } from "react-router";
import { useAuth } from "./lib/AuthContext";
import Navbar from "./components/Navbar";

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

export { ProtectedRoute, PublicAppRoute, LoggedOutOnlyRoute };
