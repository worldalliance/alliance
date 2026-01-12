import Spinner from "@alliance/sharedweb/ui/Spinner";
import { useAuth } from "../../lib/AuthContext";
import CommunityPage from "./CommunityPage";
import NoCommunityPage from "./NoCommunityPage";

const CommunityRoute = () => {
  const { user } = useAuth();

  if (!user) {
    return <Spinner />;
  }

  if (!user.communities.length) {
    return <NoCommunityPage />;
  }
  return <CommunityPage />;
};

export default CommunityRoute;
