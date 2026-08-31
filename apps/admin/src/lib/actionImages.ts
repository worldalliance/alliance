import { changedPhoto } from "@alliance/common/image-src";
import type {
  ActionDto,
  AdminActionDto,
  CreateActionDto,
} from "@alliance/shared/client";

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

/**
 * The image fields duplicating an action sends. A save leaves a column alone by
 * sending nothing for it, and a new action has no column to leave alone, so an
 * unsent field falls back to what the original stores.
 */
export function duplicatedActionImages({
  form,
  action,
  imageKey,
}: {
  form: Pick<CreateActionDto, "squareThumbnailImage">;
  action: Pick<
    AdminActionDto,
    "squareThumbnailImage" | "storedImage" | "storedSquareThumbnailImage"
  > | null;
  imageKey: string | null;
}): Pick<CreateActionDto, "image" | "squareThumbnailImage"> {
  const changed = changedActionImages({ form, action, imageKey });
  return {
    image: changed.image ?? action?.storedImage,
    squareThumbnailImage:
      changed.squareThumbnailImage ?? action?.storedSquareThumbnailImage,
  };
}
