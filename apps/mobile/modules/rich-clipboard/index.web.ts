import type { RichClipboardContent } from "./src/RichClipboard.types";

export async function setHtmlAsync(
  content: RichClipboardContent,
): Promise<void> {
  await navigator.clipboard.write([
    new ClipboardItem({
      "text/html": new Blob([content.html], { type: "text/html" }),
      "text/plain": new Blob([content.text], { type: "text/plain" }),
    }),
  ]);
}
