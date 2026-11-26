import type { ImagesItem } from "@alliance/common/forms/display-blocks";
import { resolveImageSrc } from "@alliance/sharedweb/lib/imageSrc";
import { useDragReorder } from "../../lib/useDragReorder";
import { ItemList, ItemRow } from "../../pages/forms/builder/kit/ItemList";
import { Input } from "../../ui/Input";
import { Field } from "../../ui/templates/Form";
import { BlockTextField } from "./BlockTextField";
import { rowKeys } from "./imageItems";

/** The images of a block as rows: a 48 px thumbnail beside the caption, alt text and file name. */
export function ImageRows({
  images,
  downloadable,
  setImages,
}: {
  images: ImagesItem[];
  downloadable: boolean;
  setImages: (images: ImagesItem[]) => void;
}) {
  const keys = rowKeys(images);
  const drag = useDragReorder(images, setImages);
  const update = (index: number, updates: Partial<ImagesItem>) =>
    setImages(
      images.map((entry, i) =>
        i === index ? { ...entry, ...updates } : entry,
      ),
    );
  const swap = (from: number, to: number) => {
    const next = [...images];
    [next[from], next[to]] = [next[to], next[from]];
    setImages(next);
  };

  return (
    <ItemList label="Images">
      {images.map((image, index) => (
        <ItemRow
          key={keys[index]}
          name={`Image ${index + 1}`}
          onMoveUp={index === 0 ? null : () => swap(index, index - 1)}
          onMoveDown={
            index === images.length - 1 ? null : () => swap(index, index + 1)
          }
          onRemove={() => setImages(images.filter((_, i) => i !== index))}
          removeLabel="Remove image"
          drag={{
            onDragStart: drag.handleDragStart(index),
            onDragEnd: drag.handleDragEnd,
            onDragOver: drag.handleDragOver(index),
            onDrop: drag.handleDrop(index),
            dropPosition:
              drag.dragOverIndex === index ? drag.dropPosition : null,
            dragging: drag.draggedIndex === index,
          }}
        >
          <div className="flex items-start gap-3">
            <img
              src={resolveImageSrc(image.src)}
              alt=""
              className="size-12 shrink-0 rounded-md bg-surface-2 object-cover"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <BlockTextField
                label="Caption"
                ariaLabel={`Caption, image ${index + 1}`}
                mark="optional"
                value={image.caption ?? ""}
                onChange={(caption) =>
                  update(index, { caption: caption || undefined })
                }
              />
              <BlockTextField
                label="Alt text"
                ariaLabel={`Alt text, image ${index + 1}`}
                mark="optional"
                value={image.alt ?? ""}
                onChange={(alt) => update(index, { alt: alt || undefined })}
              />
              {downloadable && (
                <Field label="Download file name" help="Defaults to “image”.">
                  {(control) => (
                    <Input
                      {...control}
                      value={image.fileName ?? ""}
                      onChange={(event) =>
                        update(index, {
                          fileName: event.target.value || undefined,
                        })
                      }
                    />
                  )}
                </Field>
              )}
            </div>
          </div>
        </ItemRow>
      ))}
    </ItemList>
  );
}
