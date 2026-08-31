import { changedPhoto } from "@alliance/common/image-src";
import type { ActionDto, CreateActionDto } from "@alliance/shared/client";

/**
 * The image fields an action save sends. ActionDto renders both columns as
 * urls and the dashboard seeds its form from the dto, so a field the admin
 * left alone goes unsent rather than storing that url over the upload key it
 * was rendered from. `imageKey` holds an image the admin just uploaded.
 */
export function changedActionImages({
  form,
  action,
  imageKey,
}: {
  form: Pick<CreateActionDto, "squareThumbnailImage">;
  action: Pick<ActionDto, "squareThumbnailImage"> | null;
  imageKey: string | null;
}): Pick<CreateActionDto, "image" | "squareThumbnailImage"> {
  return {
    image: imageKey ?? undefined,
    squareThumbnailImage:
      changedPhoto({
        current: action?.squareThumbnailImage ?? null,
        next: form.squareThumbnailImage ?? null,
      }) ?? undefined,
  };
}
