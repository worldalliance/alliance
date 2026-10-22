type FollowUpFormWindow = {
  startDate?: Date | string | null;
  endDate?: Date | string | null;
};

export function isFollowUpFormActiveAt(
  f: FollowUpFormWindow,
  now: Date,
): boolean {
  if (!f.startDate || new Date(f.startDate) > now) {
    return false;
  }
  if (f.endDate && new Date(f.endDate) < now) {
    return false;
  }
  return true;
}

export function isFollowUpFormActive(f: FollowUpFormWindow): boolean {
  return isFollowUpFormActiveAt(f, new Date());
}
