/**
 * Escapes the characters Slack treats as control sequences in message text
 * (`&`, `<`, `>` — the `<...>` syntax is how Slack encodes mentions like
 * `<!channel>` and links). `EventLogService.sendMessage` applies this to the
 * whole `message` at the Slack boundary, so ordinary callers never need it;
 * call it directly only for untrusted text interpolated into an explicit
 * `slackMessage` (which is sent verbatim to allow intentional markup). This
 * is deliberately not HTML escaping: Slack reserves only these three
 * characters, and escaped quotes would render literally as `&quot;`.
 */
export function escapeSlackText(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
