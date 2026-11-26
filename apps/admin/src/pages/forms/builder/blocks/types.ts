import type {
  DisplayBlock,
  DisplayKind,
} from "@alliance/common/forms/display-blocks";
import type { AnyField } from "@alliance/common/forms/form-schema";
import type { ComponentType } from "react";
import type { AddressedWrite } from "../../../../lib/displayBlockById";
import type { OutputBlockOption } from "../conditions/ContextRules";

export interface BaseDisplayBlockProps<T extends DisplayBlock> {
  block: T;
  onUpdate: (updates: Partial<T>) => void;
  /**
   * Write the block as the form holds it now, addressed by id, for a handler
   * that outlives the render it was made in. Null when the form no longer
   * holds the block. Absent where the form cannot address the block.
   */
  updateCurrent?: AddressedWrite;
  onRemove: () => void;
  previousFields?: AnyField[];
  laterFields?: AnyField[];
  outputBlocks?: OutputBlockOption[];
}

export type BlockOfKind = { [B in DisplayBlock as B["kind"]]: B };

export type BlockEditor<K extends DisplayKind> = ComponentType<
  BaseDisplayBlockProps<BlockOfKind[K]>
>;
