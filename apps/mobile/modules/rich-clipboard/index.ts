import { requireNativeModule } from "expo";
import type { RichClipboardContent } from "./src/RichClipboard.types";

type NativeRichClipboard = {
  setHtmlAsync(html: string, text: string): Promise<void>;
};

const native = requireNativeModule<NativeRichClipboard>("RichClipboard");

/** Copies `html` for rich paste targets and `text` for plain ones. */
export function setHtmlAsync(content: RichClipboardContent): Promise<void> {
  return native.setHtmlAsync(content.html, content.text);
}
