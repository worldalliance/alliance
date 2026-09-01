import type {
  ImagesBlock,
  ImagesItem,
} from "@alliance/common/forms/display-blocks";
import { pickForCount, withCount } from "@alliance/common/plural";
import { imageUploadFailed } from "@alliance/shared/lib/copy";
import { uploadImageDataUri } from "@alliance/shared/lib/uploadImageDataUri";
import { cn } from "@alliance/shared/styles/util";
import RenderDisplayBlock from "@alliance/sharedweb/forms/RenderDisplayBlock";
import { resolveImageSrc } from "@alliance/sharedweb/lib/imageSrc";
import { readFileDataUri } from "@alliance/sharedweb/lib/readFileDataUri";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import UploadingWithCancel from "@alliance/sharedweb/ui/UploadingWithCancel";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { VariableTextField } from "../VariableTextField";
import {
  DisplayBlockWrapper,
  type BlockWriteLanding,
  type LandingFor,
  type TargetLabel,
} from "./DisplayBlockWrapper";
import type { BaseDisplayBlockProps } from "./types";

function newItemId(): string {
  return `img-${crypto.randomUUID()}`;
}

// Blocks migrated from the old `image` kind carry no item ids, so the first
// write from this editor backfills them. Until then `dragIds` falls back to
// the src, which is enough while the list is untouched.
function withItemIds(images: ImagesItem[]): ImagesItem[] {
  return images.map((image) =>
    image.id ? image : { ...image, id: newItemId() },
  );
}

// dnd-kit requires ids that survive reordering, and React needs the same ones
// as keys or an edit mid-drag remounts the row being dragged.
function dragIds(images: ImagesItem[]): string[] {
  const seen = new Map<string, number>();
  return images.map((image) => {
    if (image.id) return image.id;
    const occurrence = seen.get(image.src) ?? 0;
    seen.set(image.src, occurrence + 1);
    return `${image.src}#${occurrence}`;
  });
}

const rowClasses =
  "flex items-center gap-2 rounded border border-gray-200 bg-white p-2";

function Thumbnail({ src }: { src: string }) {
  return (
    <img
      src={resolveImageSrc(src)}
      alt=""
      className="h-14 w-14 shrink-0 rounded bg-zinc-100 object-cover"
    />
  );
}

function SortableImageRow({
  id,
  image,
  onUpdate,
  onRemove,
}: {
  id: string;
  image: ImagesItem;
  onUpdate: (updates: Partial<ImagesItem>) => void;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(rowClasses, isDragging && "opacity-40")}
    >
      <span
        {...attributes}
        {...listeners}
        title="Drag to reorder"
        aria-label="Drag to reorder"
        className="shrink-0 cursor-grab touch-manipulation text-zinc-400 hover:text-zinc-600"
      >
        <GripVertical size={16} />
      </span>
      <Thumbnail src={image.src} />
      <div className="flex-1 space-y-1">
        <VariableTextField
          value={image.caption ?? ""}
          onChange={(caption) => onUpdate({ caption: caption || undefined })}
          placeholder="Caption (optional)"
          className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <VariableTextField
          value={image.alt ?? ""}
          onChange={(alt) => onUpdate({ alt: alt || undefined })}
          placeholder="Alt text (optional)"
          className="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <button
        type="button"
        title="Remove image"
        aria-label="Remove image"
        onClick={onRemove}
        className="shrink-0 p-1 text-zinc-400 hover:text-red-600"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function EditableImagesBlock(props: BaseDisplayBlockProps<ImagesBlock>) {
  return (
    <DisplayBlockWrapper {...props}>
      {({
        block: activeBlock,
        onUpdate: handleUpdate,
        activeUserId,
        targetLabel,
        updateFor,
        landingFor,
      }) => (
        <ImagesEditor
          block={activeBlock}
          onUpdate={handleUpdate}
          activeUserId={activeUserId ?? null}
          targetLabel={targetLabel}
          updateFor={updateFor}
          landingFor={landingFor}
        />
      )}
    </DisplayBlockWrapper>
  );
}

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

function ImagesEditor({
  block,
  onUpdate,
  activeUserId,
  targetLabel,
  updateFor,
  landingFor,
}: {
  block: ImagesBlock;
  onUpdate: (updates: Partial<ImagesBlock>) => void;
  activeUserId: string | null;
  targetLabel: TargetLabel;
  updateFor: (
    userId: string | null,
    update: (current: ImagesBlock) => Partial<ImagesBlock>,
  ) => BlockWriteLanding;
  landingFor: LandingFor;
}) {
  const { success, warning } = useToast();
  const images = block.images;
  const ids = dragIds(images);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<UploadFailure | null>(null);
  const activeImage = images[ids.indexOf(activeId ?? "")];

  // An upload outlives the render that started it, and a container hands its
  // nested blocks no id-addressed write, so there the update still spreads the
  // form the handler was made with. A passive effect would leave the ref a
  // render behind between commit and flush, long enough for an upload to land
  // on the handler it replaces.
  const latest = useRef({
    onUpdate,
    updateFor,
    landingFor,
    activeUserId,
    targetLabel,
  });
  useLayoutEffect(() => {
    latest.current = {
      onUpdate,
      updateFor,
      landingFor,
      activeUserId,
      targetLabel,
    };
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
          // A removed block takes the error box with it, so a picture that
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

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    setImages(arrayMove(images, from, to));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center space-x-2">
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(event) => {
            const files = [...(event.target.files ?? [])];
            event.target.value = "";
            if (files.length) void uploadFiles(files);
          }}
          disabled={isUploading}
          className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
        />
        {isUploading && (
          <UploadingWithCancel
            label="Uploading..."
            cancelLabel="Cancel the upload and keep the images already added"
            onCancel={cancelUpload}
            className="text-xs text-blue-600"
          />
        )}
      </div>

      {uploadError && (
        <p className="text-xs text-red-600">
          {failureText({ failure: uploadError, activeUserId, targetLabel })}
        </p>
      )}

      {images.length === 0 ? (
        <p className="text-xs text-gray-500">
          No images yet. A single image renders on its own; more than one
          becomes a carousel.
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragStart={({ active }: DragStartEvent) =>
            setActiveId(String(active.id))
          }
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {images.map((image, index) => (
                <SortableImageRow
                  key={ids[index]}
                  id={ids[index]}
                  image={image}
                  onUpdate={(updates) =>
                    setImages(
                      images.map((entry, i) =>
                        i === index ? { ...entry, ...updates } : entry,
                      ),
                    )
                  }
                  onRemove={() =>
                    setImages(images.filter((_, i) => i !== index))
                  }
                />
              ))}
            </div>
          </SortableContext>
          <DragOverlay>
            {activeImage ? (
              <div className={cn(rowClasses, "cursor-grabbing shadow-lg")}>
                <GripVertical size={16} className="shrink-0 text-zinc-400" />
                <Thumbnail src={activeImage.src} />
                <span className="flex-1 truncate text-sm text-zinc-600">
                  {activeImage.caption || activeImage.alt || ""}
                </span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {images.length > 0 && (
        <div className="border-t border-gray-200 pt-2">
          <RenderDisplayBlock block={block} />
        </div>
      )}
    </div>
  );
}
