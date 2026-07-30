const TEXT_PLAIN = "text/plain";

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
