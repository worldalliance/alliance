import { AuthTokenStore } from "./AuthContext";

const WebTokenStore: AuthTokenStore = {
  setItem: (key: string, value: string) => {
    console.log("setItem: ", key, value);
    return Promise.resolve(localStorage.setItem(key, value));
  },
  getItem: (key: string) => {
    console.log("getItem: ", key);
    return Promise.resolve(localStorage.getItem(key));
  },
  deleteItem: (key: string) => {
    return Promise.resolve(localStorage.removeItem(key));
  },
} satisfies AuthTokenStore;

export default WebTokenStore;
