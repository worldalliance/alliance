import { useNavigate } from "react-router";
import { useAuth } from "../../lib/AuthContext";
import { useEffect } from "react";

const ProfileRedirectInner = () => {
  const { isAuthenticated, user } = useAuth();

  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(`/user/${user.id}`);
    }
  }, [isAuthenticated, user, navigate]);

  return <></>;
};

const ProfileRedirect = () => {
  return <ProfileRedirectInner />;
};

export default ProfileRedirect;
