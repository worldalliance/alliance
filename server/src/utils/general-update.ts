export function startDatePriorityComparator(
  a: {
    startDate: Date | null;
    priority: number;
  },
  b: {
    startDate: Date | null;
    priority: number;
  },
): number {
  const aTime = a.startDate ? new Date(a.startDate).getTime() : Infinity;
  const bTime = b.startDate ? new Date(b.startDate).getTime() : Infinity;
  if (aTime !== bTime) {
    // sooner first
    return aTime - bTime;
  }
  // highest priority first
  return b.priority - a.priority;
}
