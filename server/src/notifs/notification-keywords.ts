import { renderReminderKeywords } from "@alliance/common/reminderKeywords";
import { groupMembersListUrl, tasksUrl } from "src/search/approutes";

export function processKeywordReplacements(
  text: string,
  context: Omit<Parameters<typeof renderReminderKeywords>[1], "links">,
): string {
  return renderReminderKeywords(text, {
    ...context,
    links: { tasks: tasksUrl(true), groupMembers: groupMembersListUrl(true) },
  });
}
