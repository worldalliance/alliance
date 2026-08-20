import type { ImageLoadEvent } from "react-native";

type Size = { width: number; height: number };

function readSize(value: unknown): Size | null {
  if (typeof value !== "object" || value === null) return null;
  if (!("width" in value) || !("height" in value)) return null;
  const { width, height } = value;
  if (typeof width !== "number" || typeof height !== "number") return null;
  return height > 0 ? { width, height } : null;
}

// react-native-web forwards the raw DOM load event, which carries the decoded
// size on the <img> target instead of in `source`.
export function getImageLoadSize(event: ImageLoadEvent): Size | null {
  const native: unknown = event.nativeEvent;
  if (typeof native !== "object" || native === null) return null;

  if ("source" in native) {
    const size = readSize(native.source);
    if (size) return size;
  }

  if ("target" in native) {
    const target = native.target;
    if (
      typeof target === "object" &&
      target !== null &&
      "naturalWidth" in target &&
      "naturalHeight" in target
    ) {
      return readSize({
        width: target.naturalWidth,
        height: target.naturalHeight,
      });
    }
  }

  return null;
}
