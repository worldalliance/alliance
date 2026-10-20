export type GroupErrorReporting = {
  setError: (message: string | null) => void;
  reportError: (err: unknown, fallback: string) => void;
};
