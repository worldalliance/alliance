export const sessionExpiredMessage = "Your session expired. Log in again.";

// A refused upload is not replayed after the session refresh, so the admin
// sends it again; if the refresh failed too, only logging in helps.
export const uploadSessionExpiredMessage =
  "Your session had expired. Upload the files again, or log in again if this repeats.";
