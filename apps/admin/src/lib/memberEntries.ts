import type { UserDto } from "@alliance/shared/client";

/**
 * Member ids or emails pasted as text, separated by commas, semicolons or
 * whitespace, matched against `users`. Entries matching no member come back
 * as written, so the admin sees each one.
 */
export function matchMemberEntries({
  text,
  users,
}: {
  text: string;
  users: readonly Pick<UserDto, "id" | "email">[];
}): { userIds: number[]; unmatched: string[] } {
  const byId = new Map(users.map((user) => [String(user.id), user.id]));
  const byEmail = new Map(
    users.map((user) => [user.email.toLowerCase(), user.id]),
  );
  const userIds: number[] = [];
  const unmatched: string[] = [];
  for (const entry of text.split(/[\s,;]+/).filter((each) => each !== "")) {
    const id = byId.get(entry) ?? byEmail.get(entry.toLowerCase());
    if (id === undefined) unmatched.push(entry);
    else if (!userIds.includes(id)) userIds.push(id);
  }
  return { userIds, unmatched };
}
