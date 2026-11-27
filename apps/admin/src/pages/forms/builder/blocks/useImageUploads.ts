import type {
  ImagesBlock,
  ImagesItem,
} from "@alliance/common/forms/display-blocks";
import { pickForCount, withCount } from "@alliance/common/plural";
import { imageUploadFailed } from "@alliance/shared/lib/copy";
import { uploadImageDataUri } from "@alliance/shared/lib/uploadImageDataUri";
import { readFileDataUri } from "@alliance/sharedweb/lib/readFileDataUri";
import { useLayoutEffect, useRef, useState } from "react";
import { useToast } from "../../../../ui/ToastProvider";
import { newItemId, withItemIds } from "./imageItems";
import type { BlockWriteLanding, LandingFor } from "./perUserContent";
import type { TargetLabel } from "./useManualTargets";

type UploadFailure = {
  targetUserId: string | null;
  added: string | null;
  reason: string;
};

// A count reads as a count of the list on screen, which is the wrong list once
// the admin has paged away from the target the batch was picked for.
function failureText({
  failure,
  activeUserId,
  targetLabel,
}: {
  failure: UploadFailure;
  activeUserId: string | null;
  targetLabel: TargetLabel;
}): string {
  if (activeUserId === failure.targetUserId) {
    return failure.added
      ? `${failure.added}. ${failure.reason}`
      : failure.reason;
  }
  return `${failure.added ?? "Nothing was added"} for ${targetLabel(failure.targetUserId)}. ${failure.reason}`;
}

export function useImageUploads(params: {
  onUpdate: (updates: Partial<ImagesBlock>) => void;
  activeUserId: string | null;
  targetLabel: TargetLabel;
  updateFor: (
    userId: string | null,
    update: (current: ImagesBlock) => Partial<ImagesBlock>,
  ) => BlockWriteLanding;
  landingFor: LandingFor;
}) {
  const { activeUserId, targetLabel } = params;
  const { success, warning } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<UploadFailure | null>(null);

  // An upload outlives the render that started it, and a container hands its
  // nested blocks no id-addressed write, so there the update still spreads the
  // form the handler was made with. A passive effect would leave the ref a
  // render behind between commit and flush, long enough for an upload to land
  // on the handler it replaces.
  const latest = useRef(params);
  useLayoutEffect(() => {
    latest.current = params;
  });

  const setImages = (next: ImagesItem[]) =>
    latest.current.onUpdate({ images: withItemIds(next) });

  // The admin can page to another user's override, or back to the default,
  // while the pictures go up, so they land on the target the pick started on
  // rather than the one on screen when they arrive.
  const appendImages = (targetUserId: string | null, added: ImagesItem[]) =>
    latest.current.updateFor(targetUserId, (current) => ({
      images: withItemIds([...current.images, ...added]),
    }));

  const inFlight = useRef<AbortController | null>(null);
  const cancelUpload = () => {
    inFlight.current?.abort();
    inFlight.current = null;
    setIsUploading(false);
  };

  const uploadFiles = async (files: File[]) => {
    const target = activeUserId;
    const batch = new AbortController();
    inFlight.current = batch;
    setIsUploading(true);
    setUploadError(null);
    const uploaded: ImagesItem[] = [];
    const failures: string[] = [];

    try {
      // Sequential on purpose: each file is sent as a base64 data URI, so a
      // whole picked batch in flight at once is a burst of multi-megabyte
      // request bodies at the image endpoint.
      for (const file of files) {
        const dataUri = await readFileDataUri(file, batch.signal);
        if (batch.signal.aborted) break;
        if (!dataUri.ok) {
          failures.push(dataUri.error.message);
          continue;
        }
        const upload = await uploadImageDataUri(dataUri.value, batch.signal);
        if (batch.signal.aborted) break;
        if (upload.ok) {
          uploaded.push({ id: newItemId(), src: upload.value });
        } else {
          failures.push(upload.error);
        }
      }
    } catch (thrown) {
      // The change handler fires this without awaiting, so a throw would
      // otherwise surface as an unhandled rejection with nothing on screen.
      console.error("Failed to upload images:", thrown);
      failures.push(imageUploadFailed);
    } finally {
      // Freeing the block comes first: anything that throws below it would
      // otherwise leave the file input disabled with the cancel gone.
      if (inFlight.current === batch) {
        inFlight.current = null;
        setIsUploading(false);
      }
      // A block that stops holding per-user content mid-upload takes the write
      // to the default, so the messages name where the pictures landed rather
      // than the target they were picked for. A batch with nothing to write
      // asks where one would have landed instead.
      const landing = uploaded.length
        ? appendImages(target, uploaded)
        : latest.current.landingFor(target);
      const where = landing?.userId ?? null;
      if (failures.length) {
        // The total a dropped batch would count against includes files it
        // never tried.
        const of = batch.signal.aborted ? "" : ` of ${files.length}`;
        setUploadError({
          targetUserId: where,
          added: uploaded.length ? `Added ${uploaded.length}${of}` : null,
          reason: failures[0] ?? imageUploadFailed,
        });
      }
      if (uploaded.length) {
        if (!landing) {
          // A removed block takes the error line with it, so a picture that
          // reached the server and found nothing to join has only this left to
          // say so.
          warning(
            `Dropped ${withCount(uploaded.length, "image")}. The block ${pickForCount(uploaded.length, "it was", "they were")} going into is gone.`,
          );
        } else if (
          // Landing somewhere the admin has paged away from changes nothing on
          // screen, which reads as the upload having failed. A part-failed
          // batch says so in its own error, which already names the target.
          !failures.length &&
          latest.current.activeUserId !== where
        ) {
          success(
            `Added ${withCount(uploaded.length, "image")} for ${latest.current.targetLabel(where)}.`,
          );
        }
      }
    }
  };

  return {
    isUploading,
    cancelUpload,
    uploadFiles,
    setImages,
    errorText: uploadError
      ? failureText({ failure: uploadError, activeUserId, targetLabel })
      : null,
  };
}
