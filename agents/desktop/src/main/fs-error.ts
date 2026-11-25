export const hasCode = (error: unknown, code: string): boolean =>
  error instanceof Error && "code" in error && error.code === code;

export const isNotFound = (error: Error): boolean => hasCode(error, "ENOENT");
