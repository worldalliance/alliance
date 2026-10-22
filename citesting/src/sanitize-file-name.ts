export const sanitizeFileName = (
  value: string,
  { fallback }: { fallback: string },
) =>
  value
    .replace(/^\//, "")
    .replace(/\//g, "-")
    .replace(/[^a-zA-Z0-9-_.]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || fallback;
