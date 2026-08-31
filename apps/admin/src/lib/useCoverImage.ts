import { imageUploadFailed } from "@alliance/shared/lib/copy";
import { uploadImageDataUri } from "@alliance/shared/lib/uploadImageDataUri";
import { imageSrcFromKey } from "@alliance/sharedweb/lib/imageSrc";
import { readFileDataUri } from "@alliance/sharedweb/lib/readFileDataUri";
import { useCallback, useRef, useState } from "react";

export type CoverImage = {
  /** The upload a save should send, or null to leave the stored image alone. */
  key: string | null;
  preview: string | null;
  error: string | null;
  /** Never rejects: a failure comes back as `error`. */
  pick: (file: File) => Promise<void>;
  /** Seeds the preview from a stored image and drops any pick in flight. */
  reset: (storedImage: string | null) => void;
};

export function useCoverImage(): CoverImage {
  const [key, setKeyState] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Which pick owns the key and the preview. Bumping it drops the result of a
  // pick still in flight, whether a later pick replaced it or the draft
  // reseeded from another action.
  const latestPick = useRef(0);
  const keyRef = useRef<string | null>(null);
  const storedImage = useRef<string | null>(null);

  const setKey = (next: string | null) => {
    keyRef.current = next;
    setKeyState(next);
  };

  const reset = useCallback((next: string | null) => {
    latestPick.current++;
    storedImage.current = next;
    setKey(null);
    setPreview(next);
    setError(null);
  }, []);

  const pick = useCallback(async (file: File) => {
    const pickNumber = ++latestPick.current;
    const superseded = () => latestPick.current !== pickNumber;
    // Reverting to the stored image alone would leave the preview disagreeing
    // with the key a save would still send.
    const savedPreview = () =>
      keyRef.current ? imageSrcFromKey(keyRef.current) : storedImage.current;
    // Cleared as the pick starts, so a retry that fails the same way still
    // reads as a retry rather than as the message already on screen.
    setError(null);

    try {
      const dataUri = await readFileDataUri(file);
      if (superseded()) return;
      if (!dataUri.ok) {
        setError(dataUri.error.message);
        setPreview(savedPreview());
        return;
      }

      setPreview(dataUri.value);

      const uploaded = await uploadImageDataUri(dataUri.value);
      if (superseded()) return;
      if (!uploaded.ok) {
        setError(uploaded.error);
        setPreview(savedPreview());
        return;
      }
      setKey(uploaded.value);
      setPreview(imageSrcFromKey(uploaded.value));
    } catch (thrown) {
      // The change handler fires this without awaiting, so a throw would
      // otherwise surface as an unhandled rejection with nothing shown and the
      // preview left on a picture no save would send.
      console.error("Failed to set the cover image:", thrown);
      if (superseded()) return;
      setError(imageUploadFailed);
      setPreview(savedPreview());
    }
  }, []);

  return { key, preview, error, pick, reset };
}
