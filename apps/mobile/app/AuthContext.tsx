import { useMemo } from "react";
import {
  AuthTokenStore,
  BaseAuthProvider,
} from "../../../shared/lib/BaseAuthContext";
import { getItem, setItem, deleteItemAsync } from "expo-secure-store";
export const AuthProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const tokenStore = useMemo(() => {
    return {
      setItem: setItem,
      getItem: getItem,
      removeItem: deleteItemAsync,
    } satisfies AuthTokenStore;
  }, []);

  return (
    <BaseAuthProvider
      navigateOnLogin={() => {}}
      navigateOnLogout={() => {}}
      tokenStore={tokenStore}
    >
      {children}
    </BaseAuthProvider>
  );
};
