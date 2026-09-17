export enum AuthTabResultType {
  Success = "success",
  Cancel = "cancel",
  VerificationFailed = "verification_failed",
  VerificationTimedOut = "verification_timed_out",
  Unknown = "unknown",
}

export type AuthTabResult = {
  type: AuthTabResultType;
  resultCode: number;
  url: string | null;
};
