import { useAuth } from "../../lib/AuthContext";
import CommunityPage from "./CommunityPage";
import PageSpinner from "./PageSpinner";

const CommunityRoute = () => {
  const { user } = useAuth();

  if (!user) {
    return <PageSpinner />;
  }

  return <CommunityPage />;
};

export default CommunityRoute;
