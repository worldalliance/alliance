import { Redirect } from "expo-router";
import { useAuth } from "../../lib/AuthContext";

const ProfileScreen = () => {
  const { user } = useAuth();

  return <Redirect href={`/member/${user?.id}`} />;
};

export default ProfileScreen;
