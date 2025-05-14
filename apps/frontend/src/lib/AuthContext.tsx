import { BaseAuthProvider } from "../../../../shared/lib/BaseAuthContext";
import { useNavigate } from "react-router-dom";
import BrowserStorage from "./BrowserStorage";
export const AuthProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const navigate = useNavigate();

  return (
    <BaseAuthProvider
      navigateOnLogin={() => navigate("/home")}
      navigateOnLogout={() => navigate("/login")}
      tokenStore={BrowserStorage}
    >
      {children}
    </BaseAuthProvider>
  );
};
