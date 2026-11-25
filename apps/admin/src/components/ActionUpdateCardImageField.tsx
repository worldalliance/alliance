import type { DisplayOnlySchema } from "@alliance/common/forms/display-only-schema";
import { isUploadKey } from "@alliance/common/image-src";
import { uploadImageDataUri } from "@alliance/shared/lib/uploadImageDataUri";
import { resolveImageSrc } from "@alliance/sharedweb/lib/imageSrc";
import { readFileDataUri } from "@alliance/sharedweb/lib/readFileDataUri";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { useMemo, useState } from "react";
import type { CardImageChoice } from "../lib/actionUpdateDetails";

const PICK_BUTTON =
  "inline-flex cursor-pointer items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-gray-50 focus-within:ring-2 focus-within:ring-blue-500";

export function ActionUpdateCardImageField({
  savedSrc,
  schema,
  choice,
  onChange,
}: {
  savedSrc: string | null;
  schema: DisplayOnlySchema | null;
  choice: CardImageChoice;
  onChange: (choice: CardImageChoice) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shownSrc =
    choice.kind === "set"
      ? resolveImageSrc(choice.key)
      : choice.kind === "cleared"
        ? null
        : savedSrc;

  // Only uploaded images can be saved as the card image.
  const updateImages = useMemo(
    () =>
      (schema?.blocks ?? [])
        .flatMap((block) => (block.kind === "images" ? block.images : []))
        .filter((image) => isUploadKey(image.src)),
    [schema],
  );

  const upload = async (file: File) => {
    setError(null);
    setUploading(true);
    const read = await readFileDataUri(file);
    const uploaded = read.ok
      ? await uploadImageDataUri(read.value)
      : { ok: false as const, error: read.error.message };
    setUploading(false);
    if (uploaded.ok) onChange({ kind: "set", key: uploaded.value });
    else setError(uploaded.error);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex aspect-3/2 w-full max-w-sm items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-zinc-100">
        {shownSrc ? (
          <img
            src={shownSrc}
            alt="Card image preview"
            className="size-full object-cover"
          />
        ) : (
          <p className="px-6 text-center text-sm text-gray-600">
            No card image. The card shows this update&apos;s images, or the
            action&apos;s cover image if it has none.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className={PICK_BUTTON}>
          {shownSrc ? "Upload a different image" : "Upload image"}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void upload(file);
            }}
          />
        </label>
        {shownSrc && (
          <Button
            color={ButtonColor.Transparent}
            onClick={() => onChange({ kind: "cleared" })}
          >
            Remove card image
          </Button>
        )}
      </div>
      {uploading && (
        <p role="status" className="text-sm text-gray-600">
          Uploading…
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      {updateImages.length > 0 && (
        <div>
          <p className="mb-2 text-sm text-gray-700">
            Or use an image from this update:
          </p>
          <div className="flex flex-wrap gap-2">
            {updateImages.map((image, position) => (
              <button
                key={image.id ?? `${image.src}-${position}`}
                type="button"
                onClick={() => onChange({ kind: "set", key: image.src })}
                aria-label={`Use ${image.alt || image.fileName || `image ${position + 1}`} as the card image`}
                className="size-20 cursor-pointer overflow-hidden rounded-md border border-gray-300 hover:ring-2 hover:ring-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500 outline-hidden"
              >
                <img
                  src={resolveImageSrc(image.src)}
                  alt=""
                  className="size-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
