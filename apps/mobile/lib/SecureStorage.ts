import * as SecureStore from "expo-secure-store";
import { AuthTokenStore } from "./AuthContext";

const SecureStorage: AuthTokenStore = {
  setItem: (key: string, value: string) => {
    return SecureStore.setItemAsync(key, value);
  },
  getItem: (key: string) => {
    return SecureStore.getItemAsync(key);
  },
  deleteItem: (key: string) => {
    return SecureStore.deleteItemAsync(key);
  },
};

export default SecureStorage;
