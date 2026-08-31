import type {
  AccordionBlock,
  AccordionSection,
  NestedDisplayBlock,
} from "@alliance/common/forms/display-blocks";
import { NESTABLE_DISPLAY_KINDS } from "@alliance/common/forms/display-blocks";
import { DISPLAY_KIND_NAMES } from "@alliance/common/forms/element-descriptors";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { VariableTextField } from "../VariableTextField";
import { createDisplayBlock } from "./createDisplayBlock";
import { DisplayBlockWrapper } from "./DisplayBlockWrapper";
import { EditableNestedBlock } from "./EditableNestedBlock";
import { PerViewerOptions } from "./PerViewerOptionsContext";
import type { BaseDisplayBlockProps } from "./types";

const newBlockId = () =>
  `block-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

const move = <T,>(items: T[], index: number, direction: -1 | 1): T[] => {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
};

const moveButtonClass =
  "p-1 text-zinc-400 hover:text-zinc-600 disabled:opacity-30";

export function EditableAccordionBlock(
  props: BaseDisplayBlockProps<AccordionBlock>,
) {
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

            {sections.map((section, index) => (
              <div
                key={section.id ?? index}
                className="rounded-md border border-gray-200 p-2 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <VariableTextField
                    value={section.title}
                    onChange={(title) => updateSection(index, { title })}
                    className="flex-1 text-gray-900 border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Section title"
                  />
                  <button
                    type="button"
                    title="Move section up"
                    onClick={() => setSections(move(sections, index, -1))}
                    disabled={index === 0}
                    className={moveButtonClass}
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    title="Move section down"
                    onClick={() => setSections(move(sections, index, 1))}
                    disabled={index === sections.length - 1}
                    className={moveButtonClass}
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    type="button"
                    title="Remove section"
                    onClick={() =>
                      setSections(sections.filter((_, i) => i !== index))
                    }
                    className="p-1 text-zinc-400 hover:text-red-600"
                  >
                    <X size={14} />
                  </button>
                </div>

                <PerViewerOptions allowed={false}>
                  {section.blocks.map((nested, nestedIndex) => (
                    <div
                      key={nested.id ?? nestedIndex}
                      className="flex items-start gap-1"
                    >
                      <div className="flex flex-col pt-2">
                        <button
                          type="button"
                          title="Move block up"
                          onClick={() =>
                            setBlocks(
                              index,
                              move(section.blocks, nestedIndex, -1),
                            )
                          }
                          disabled={nestedIndex === 0}
                          className={moveButtonClass}
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          type="button"
                          title="Move block down"
                          onClick={() =>
                            setBlocks(
                              index,
                              move(section.blocks, nestedIndex, 1),
                            )
                          }
                          disabled={nestedIndex === section.blocks.length - 1}
                          className={moveButtonClass}
                        >
                          <ArrowDown size={14} />
                        </button>
                      </div>
                      <div className="flex-1">
                        <EditableNestedBlock
                          block={nested}
                          onChange={(next) =>
                            setBlocks(
                              index,
                              section.blocks.map((candidate, i) =>
                                i === nestedIndex ? next : candidate,
                              ),
                            )
                          }
                          onRemove={() =>
                            setBlocks(
                              index,
                              section.blocks.filter(
                                (_, i) => i !== nestedIndex,
                              ),
                            )
                          }
                        />
                      </div>
                    </div>
                  ))}
                </PerViewerOptions>

                <select
                  value=""
                  onChange={(e) => {
                    const kind = NESTABLE_DISPLAY_KINDS.find(
                      (candidate) => candidate === e.target.value,
                    );
                    if (!kind) return;
                    setBlocks(index, [
                      ...section.blocks,
                      createDisplayBlock(kind, newBlockId()),
                    ]);
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
            ))}

            <button
              type="button"
              onClick={() =>
                setSections([
                  ...sections,
                  { id: newBlockId(), title: "Section title", blocks: [] },
                ])
              }
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
