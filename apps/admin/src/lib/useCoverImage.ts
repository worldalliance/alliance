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
  uploading: boolean;
  /** Never rejects: a failure comes back as `error`. */
  pick: (file: File) => Promise<void>;
  /** Drops a pick in flight and keeps the last image that landed. */
  cancel: () => void;
  /** Seeds the preview from a stored image and drops any pick in flight. */
  reset: (storedImage: string | null) => void;
};

export function useCoverImage(): CoverImage {
  const [key, setKeyState] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The pick a save waits on, or 0. A flag would free the save when an earlier
  // pick settles; a count would hold it for a pick the draft has dropped.
  const [pendingPick, setPendingPick] = useState(0);
  // Which pick owns the key and the preview. Bumping it drops the result of a
  // pick still in flight, whether a later pick replaced it or the draft
  // reseeded from another action.
  const latestPick = useRef(0);
  const keyRef = useRef<string | null>(null);
  const storedImage = useRef<string | null>(null);
  const inFlight = useRef<AbortController | null>(null);

  const setKey = (next: string | null) => {
    keyRef.current = next;
    setKeyState(next);
  };

  // Reverting to the stored image alone would leave the preview disagreeing
  // with the key a save would still send.
  const settledPreview = useCallback(
    () =>
      keyRef.current ? imageSrcFromKey(keyRef.current) : storedImage.current,
    [],
  );

  // Bumping the counter drops the result; the abort stops the request still
  // sending it.
  const dropPickInFlight = useCallback(() => {
    latestPick.current++;
    inFlight.current?.abort();
    inFlight.current = null;
    setPendingPick(0);
  }, []);

  const reset = useCallback(
    (next: string | null) => {
      dropPickInFlight();
      storedImage.current = next;
      setKey(null);
      setPreview(next);
      setError(null);
    },
    [dropPickInFlight],
  );

  const cancel = useCallback(() => {
    dropPickInFlight();
    setPreview(settledPreview());
    setError(null);
  }, [dropPickInFlight, settledPreview]);

  const pick = useCallback(
    async (file: File) => {
      dropPickInFlight();
      const pickNumber = latestPick.current;
      const superseded = () => latestPick.current !== pickNumber;
      const upload = new AbortController();
      inFlight.current = upload;
      // Cleared as the pick starts, so a retry that fails the same way still
      // reads as a retry rather than as the message already on screen.
      setError(null);
      setPendingPick(pickNumber);

      try {
        const dataUri = await readFileDataUri(file);
        if (superseded()) return;
        if (!dataUri.ok) {
          setError(dataUri.error.message);
          setPreview(settledPreview());
          return;
        }

        setPreview(dataUri.value);

        const uploaded = await uploadImageDataUri(dataUri.value, upload.signal);
        if (superseded()) return;
        if (!uploaded.ok) {
          setError(uploaded.error);
          setPreview(settledPreview());
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
        setPreview(settledPreview());
      } finally {
        setPendingPick((pending) => (pending === pickNumber ? 0 : pending));
        if (inFlight.current === upload) inFlight.current = null;
      }
    },
    [dropPickInFlight, settledPreview],
  );

  return {
    key,
    preview,
    error,
    uploading: pendingPick !== 0,
    pick,
    cancel,
    reset,
  };
}
