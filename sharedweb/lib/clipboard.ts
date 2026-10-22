import type { ClipboardContent } from "@alliance/shared/lib/clipboard";

const TEXT_PLAIN = "text/plain";
const TEXT_HTML = "text/html";

export enum CopyOutcome {
  Copied = "copied",
  Failed = "failed",
}

/**
 * Copy text to the clipboard, reporting whether it landed.
 *
 * Pass a promise when the text is still in flight — a link the click itself is
 * creating, say. Safari revokes the user-gesture grant across an `await`, so
 * copying once the request resolves silently fails there; handing
 * `ClipboardItem` the pending promise instead keeps the write inside the
 * gesture. That only holds if this is called synchronously from the event
 * handler, before anything else is awaited.
 */
export async function copyToClipboard(
  text: string | Promise<string>,
): Promise<boolean> {
  if (typeof text !== "string" && typeof ClipboardItem !== "undefined") {
    const blob = text.then(
      (resolved) => new Blob([resolved], { type: TEXT_PLAIN }),
    );
    // The clipboard normally consumes this; the handler keeps a failed request
    // from surfacing as an unhandled rejection where it does not.
    blob.catch(() => {});
    const item = new ClipboardItem({ [TEXT_PLAIN]: blob });
    try {
      await navigator.clipboard.write([item]);
      return true;
    } catch {
      // Browsers that reject a still-pending ClipboardItem fall through to the
      // plain write, which may find the gesture already expired.
    }
  }
  try {
    await navigator.clipboard.writeText(await text);
    return true;
  } catch {
    return false;
  }
}

async function copyHtmlToClipboard({
  text,
  html,
}: Required<ClipboardContent>): Promise<boolean> {
  if (typeof ClipboardItem !== "undefined") {
    const item = new ClipboardItem({
      [TEXT_PLAIN]: new Blob([text], { type: TEXT_PLAIN }),
      [TEXT_HTML]: new Blob([html], { type: TEXT_HTML }),
    });
    try {
      await navigator.clipboard.write([item]);
      return true;
    } catch {
      // Browsers that refuse an html item still take the plain text.
    }
  }
  return copyToClipboard(text);
}

export async function copyOutcome(
  content: string | ClipboardContent,
): Promise<CopyOutcome> {
  const { text, html } =
    typeof content === "string" ? { text: content, html: undefined } : content;
  const copied =
    html === undefined
      ? await copyToClipboard(text)
      : await copyHtmlToClipboard({ text, html });
  return copied ? CopyOutcome.Copied : CopyOutcome.Failed;
}
