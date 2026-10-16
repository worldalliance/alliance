export const isEmptyAnswer = (value: unknown): boolean => {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
};

export const normalizeBoolean = (value: unknown): boolean | null => {
  if (value === true || value === false) return value;
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === 1) return true;
  if (value === 0) return false;
  return null;
};

export const formatAnswerValue = (v: unknown): string => {
  if (v == null || v === undefined) return "NULL";
  if (Array.isArray(v)) return v.map((x) => formatAnswerValue(x)).join(", ");
  if (typeof v === "object") {
    const o = v as { name?: string; key: string };
    if (o && typeof o === "object" && (o.name || o.key)) {
      return o.name || o.key;
    }
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
};
