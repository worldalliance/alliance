import type { DisplayBlock } from "@alliance/common/forms/display-blocks";
import type { AnyField } from "@alliance/common/forms/form-schema";
import type { AddressedWrite } from "../../lib/displayBlockById";
import type { OutputBlockOption } from "../form-fields/CommonControls";

export interface BaseDisplayBlockProps<T extends DisplayBlock> {
  block: T;
  onUpdate: (updates: Partial<T>) => void;
  /**
   * Write the block as the form holds it now, addressed by id, for a handler
   * that outlives the render it was made in. False when the form no longer
   * holds the block. Absent where the form cannot address the block by id,
   * such as one nested in a container.
   */
  updateCurrent?: AddressedWrite;
  onRemove: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  isDragging?: boolean;
  previousFields?: AnyField[];
  outputBlocks?: OutputBlockOption[];
}
