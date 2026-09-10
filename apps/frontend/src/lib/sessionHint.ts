const KEY = "was-logged-in";

/**
 * A guess at whether this device has a session, readable before `/auth/me`
 * answers. Goes stale when a session expires server-side, so only presentation
 * may depend on it.
 */
export const hasSessionHint = () => localStorage.getItem(KEY) === "true";

export const setSessionHint = () => localStorage.setItem(KEY, "true");

export const clearSessionHint = () => localStorage.removeItem(KEY);
