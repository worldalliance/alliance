export const isNotFound = (error: Error): boolean =>
  "code" in error && error.code === "ENOENT";
