import type { DisplayOnlySchema } from "@alliance/common/forms/display-only-schema";
import { isUploadKey } from "@alliance/common/image-src";
import { uploadImageDataUri } from "@alliance/shared/lib/uploadImageDataUri";
import { resolveImageSrc } from "@alliance/sharedweb/lib/imageSrc";
import { readFileDataUri } from "@alliance/sharedweb/lib/readFileDataUri";
import { useId, useMemo, useState } from "react";
import type { CardImageChoice } from "../../../lib/actionUpdateDetails";
import Button, { ButtonVariant } from "../../../ui/Button";
import { cn } from "../../../ui/cn";
import { FileInput } from "../../../ui/FileInput";

/** The update card's first photo: an upload, one of the update's own images, or none. */
export function CardImageField({
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
  const inputId = useId();
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<{ key: string; name: string }>();
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

  const choose = (next: CardImageChoice) => {
    setError(null);
    onChange(next);
  };

  const upload = async (file: File) => {
    setError(null);
    setUploading(true);
    const read = await readFileDataUri(file);
    const result = read.ok
      ? await uploadImageDataUri(read.value)
      : { ok: false as const, error: read.error.message };
    setUploading(false);
    if (result.ok) {
      setUploaded({ key: result.value, name: file.name });
      onChange({ kind: "set", key: result.value });
    } else setError(result.error);
  };

  const fileText =
    choice.kind === "set" && uploaded?.key === choice.key
      ? `Uploaded ${uploaded.name}`
      : shownSrc
        ? "Using the image above"
        : undefined;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex aspect-3/2 w-full max-w-sm items-center justify-center overflow-hidden rounded-md border border-line bg-canvas">
        {shownSrc ? (
          <img
            src={shownSrc}
            alt="Card image preview"
            className="size-full object-cover"
          />
        ) : (
          <p className="px-6 text-center text-fg-muted">
            No card image. The card shows this update&apos;s images, or the
            action&apos;s cover image if it has none.
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <FileInput
          id={inputId}
          accept="image/*"
          disabled={uploading}
          value={[]}
          emptyText={fileText}
          onChange={([file]) => {
            if (file) void upload(file);
          }}
        />
        {shownSrc && (
          <Button
            variant={ButtonVariant.GhostDanger}
            onClick={() => choose({ kind: "cleared" })}
          >
            Remove card image
          </Button>
        )}
      </div>
      {uploading && (
        <p role="status" className="text-fg-muted">
          Uploading…
        </p>
      )}
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      {updateImages.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-fg-muted">Or use an image from this update:</p>
          <div className="flex flex-wrap gap-2">
            {updateImages.map((image, position) => {
              const active = shownSrc === resolveImageSrc(image.src);
              return (
                <button
                  key={image.id ?? `${image.src}-${position}`}
                  type="button"
                  aria-pressed={active}
                  onClick={() => choose({ kind: "set", key: image.src })}
                  aria-label={`Use ${image.alt || image.fileName || `image ${position + 1}`} as the card image`}
                  className={cn(
                    "size-20 cursor-pointer overflow-hidden rounded-md border focus-ring",
                    active
                      ? "border-2 border-accent"
                      : "border-line hover:border-accent",
                  )}
                >
                  <img
                    src={resolveImageSrc(image.src)}
                    alt=""
                    className="size-full object-cover"
                  />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
