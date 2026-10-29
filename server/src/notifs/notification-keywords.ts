import { renderReminderKeywords } from "@alliance/common/reminderKeywords";
import { siteBaseUrl } from "src/search/approutes";

export function processKeywordReplacements(
  text: string,
  context: Omit<Parameters<typeof renderReminderKeywords>[1], "siteUrl">,
): string {
  return renderReminderKeywords(text, {
    ...context,
    siteUrl: siteBaseUrl() ?? "",
  });
}
