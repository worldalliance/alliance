import type { SecureStorageBackend } from "./secureStorageBackendContract";

// localStorage is not a keychain, and access plus refresh tokens land in it here.
// Web exists only as the playwright target (skills/playwright/MOBILE.md), so a
// production web bundle fails at import rather than shipping readable tokens.
if (!__DEV__) {
  throw new Error(
    "mobile web is a dev-only target: shipping it needs a real web secure-storage backend, so run the dev server rather than exporting",
  );
}

const prefix = "alliance.secure.";

export const secureStorageBackend = {
  setItem: async (key, value, _options) => {
    window.localStorage.setItem(prefix + key, value);
  },
  getItem: async (key, _options) => window.localStorage.getItem(prefix + key),
  deleteItem: async (key, _options) => {
    window.localStorage.removeItem(prefix + key);
  },
} satisfies SecureStorageBackend;
