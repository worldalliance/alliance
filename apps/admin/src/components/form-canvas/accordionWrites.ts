import type {
  AccordionSection,
  NestedDisplayBlock,
} from "@alliance/common/forms/display-blocks";
import type { PageItem } from "@alliance/common/forms/form-schema";
import type { AddressedWrite } from "../../lib/displayBlockById";
import { addressOf, findAddressed } from "./canvasSelection";

/**
 * Writes into an accordion's sections. With `updateCurrent`, they read the
 * accordion as the form holds it when they land, since a nested upload lands
 * after the render that started it; sections and blocks are found by address.
 */
export function accordionWrites({
  sections,
  onUpdate,
  updateCurrent,
}: {
  sections: AccordionSection[];
  onUpdate: (updates: Partial<PageItem>) => void;
  updateCurrent: AddressedWrite | undefined;
}) {
  const writeSections = (
    update: (current: AccordionSection[]) => AccordionSection[],
  ) => {
    if (!updateCurrent) return onUpdate({ sections: update(sections) });
    updateCurrent((current) => {
      if (current.kind !== "accordion") {
        throw new Error(`accordion became ${current.kind}`);
      }
      return { sections: update(current.sections) };
    });
  };

  const updateSection = (
    sectionIndex: number,
    update: (current: AccordionSection) => Partial<AccordionSection>,
  ) =>
    writeSections((current) => {
      const at = findAddressed(
        current,
        addressOf(sections[sectionIndex]!, sectionIndex),
      );
      return current.map((candidate, i) =>
        i === at ? { ...candidate, ...update(candidate) } : candidate,
      );
    });

  const blockWrite =
    ({
      sectionIndex,
      blockIndex,
    }: {
      sectionIndex: number;
      blockIndex: number;
    }): AddressedWrite =>
    (update) => {
      const block = sections[sectionIndex]!.blocks[blockIndex]!;
      let wrote: NestedDisplayBlock | null = null;
      updateSection(sectionIndex, (current) => {
        const at = findAddressed(current.blocks, addressOf(block, blockIndex));
        return {
          blocks: current.blocks.map((candidate, i) => {
            if (i !== at) return candidate;
            wrote = candidate;
            // Safe: `update` answers with fields of `candidate`'s own kind.
            return {
              ...candidate,
              ...update(candidate),
            } as NestedDisplayBlock;
          }),
        };
      });
      return wrote;
    };

  return { writeSections, updateSection, blockWrite };
}
