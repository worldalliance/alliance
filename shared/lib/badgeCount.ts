export function formatBadgeCount(count: number): string | null {
  if (count <= 0) return null;
  return count > 99 ? "99+" : count.toString();
}
