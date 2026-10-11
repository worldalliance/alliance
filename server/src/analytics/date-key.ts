export function formatDateKey(date: Date): string {
  return date.toISOString().split("T")[0];
}
