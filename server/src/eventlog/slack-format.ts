/**
 * Escapes the characters Slack treats as control sequences in message text
 * (`&`, `<`, `>`), so user text can't inject mentions or links. Not HTML
 * escaping: escaped quotes would render literally as `&quot;`.
 */
export function escapeSlackText(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
