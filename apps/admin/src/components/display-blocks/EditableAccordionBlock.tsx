import type {
  AccordionBlock,
  AccordionSection,
  NestedDisplayBlock,
} from "@alliance/common/forms/display-blocks";
import { NESTABLE_DISPLAY_KINDS } from "@alliance/common/forms/display-blocks";
import { DISPLAY_KIND_NAMES } from "@alliance/common/forms/element-descriptors";
import { Plus } from "lucide-react";
import {
  describeElement,
  describeSection,
  sectionBlockChild,
  sectionChild,
  sectionTitle,
} from "../form-canvas/canvasSelection";
import {
  ChildRow,
  ChildRows,
  neighborMoves,
  useSelectChild,
} from "../form-canvas/ChildRows";
import { createDisplayBlock } from "./createDisplayBlock";
import { DisplayBlockWrapper } from "./DisplayBlockWrapper";
import type { BaseDisplayBlockProps } from "./types";

const newBlockId = () =>
  `block-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

export function EditableAccordionBlock(
  props: BaseDisplayBlockProps<AccordionBlock>,
) {
  const selectChild = useSelectChild();
  return (
    <DisplayBlockWrapper {...props} perUserContent={false}>
      {({ block: activeBlock, onUpdate: handleUpdate }) => {
        const sections = activeBlock.sections;

        const setSections = (next: AccordionSection[]) =>
          handleUpdate({ sections: next });

        const updateSection = (
          index: number,
          updates: Partial<AccordionSection>,
        ) =>
          setSections(
            sections.map((section, i) =>
              i === index ? { ...section, ...updates } : section,
            ),
          );

        const setBlocks = (index: number, blocks: NestedDisplayBlock[]) =>
          updateSection(index, { blocks });

        return (
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={activeBlock.singleOpen ?? false}
                onChange={(e) =>
                  handleUpdate({ singleOpen: e.target.checked || undefined })
                }
              />
              Only one section open at a time
            </label>

            {sections.length > 0 && (
              <ChildRows>
                {sections.map((section, index) => (
                  <ChildRow
                    key={section.id ?? index}
                    label={describeSection(section)}
                    onSelect={() => selectChild(sectionChild(section, index))}
                    {...neighborMoves(sections, index, setSections)}
                    className="font-medium"
                  >
                    <div className="space-y-1 pb-2 pl-4 pr-2">
                      {section.blocks.length > 0 && (
                        <ChildRows>
                          {section.blocks.map((nested, nestedIndex) => (
                            <ChildRow
                              key={nested.id ?? nestedIndex}
                              label={describeElement(nested)}
                              onSelect={() =>
                                selectChild(
                                  sectionBlockChild({
                                    section,
                                    sectionIndex: index,
                                    block: nested,
                                    blockIndex: nestedIndex,
                                  }),
                                )
                              }
                              {...neighborMoves(
                                section.blocks,
                                nestedIndex,
                                (blocks) => setBlocks(index, blocks),
                              )}
                            />
                          ))}
                        </ChildRows>
                      )}
                      <select
                        value=""
                        aria-label={`Add block to ${sectionTitle(section)}`}
                        onChange={(e) => {
                          const kind = NESTABLE_DISPLAY_KINDS.find(
                            (candidate) => candidate === e.target.value,
                          );
                          if (!kind) return;
                          const block = createDisplayBlock(kind, newBlockId());
                          setBlocks(index, [...section.blocks, block]);
                          selectChild(
                            sectionBlockChild({
                              section,
                              sectionIndex: index,
                              block,
                              blockIndex: section.blocks.length,
                            }),
                            { focus: true },
                          );
                        }}
                        className="text-xs border border-gray-300 rounded px-2 py-1 text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="" disabled>
                          Add block…
                        </option>
                        {NESTABLE_DISPLAY_KINDS.map((kind) => (
                          <option key={kind} value={kind}>
                            {DISPLAY_KIND_NAMES[kind]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </ChildRow>
                ))}
              </ChildRows>
            )}

            <button
              type="button"
              onClick={() => {
                const section = {
                  id: newBlockId(),
                  title: "Section title",
                  blocks: [],
                };
                setSections([...sections, section]);
                selectChild(sectionChild(section, sections.length), {
                  focus: true,
                });
              }}
              className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
            >
              <Plus size={14} />
              Add section
            </button>
          </div>
        );
      }}
    </DisplayBlockWrapper>
  );
}
