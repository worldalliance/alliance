/** Whitespace alone is not content. */
export function hasContent(content: { body: string; attachments: string[] }) {
  return content.body.trim() !== "" || content.attachments.length > 0;
}
