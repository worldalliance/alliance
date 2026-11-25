import type {
  AccordionBlock,
  AccordionSection,
  NestedDisplayBlock,
} from "@alliance/common/forms/display-blocks";
import { NESTABLE_DISPLAY_KINDS } from "@alliance/common/forms/display-blocks";
import { DISPLAY_KIND_NAMES } from "@alliance/common/forms/element-descriptors";
import { InspectorGroup } from "../../pages/forms/builder/kit/InspectorGroup";
import { AddItemButton } from "../../pages/forms/builder/kit/ItemList";
import { Select } from "../../ui/Select";
import { CheckboxField } from "../../ui/templates/Form";
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
  return (
    <DisplayBlockWrapper {...props} perUserContent={false}>
      {({ block, onUpdate }) => (
        <>
          <InspectorGroup>
            <CheckboxField
              label="Only one section open at a time"
              checked={block.singleOpen ?? false}
              onChange={(event) =>
                onUpdate({ singleOpen: event.target.checked || undefined })
              }
            />
          </InspectorGroup>
          <InspectorGroup title="Sections">
            <Sections
              sections={block.sections}
              onChange={(sections) => onUpdate({ sections })}
            />
          </InspectorGroup>
        </>
      )}
    </DisplayBlockWrapper>
  );
}

function Sections({
  sections,
  onChange,
}: {
  sections: AccordionSection[];
  onChange: (sections: AccordionSection[]) => void;
}) {
  const selectChild = useSelectChild();
  const setBlocks = (index: number, blocks: NestedDisplayBlock[]) =>
    onChange(
      sections.map((section, i) =>
        i === index ? { ...section, blocks } : section,
      ),
    );

  const addBlock = (index: number, kindName: string) => {
    const section = sections[index];
    const kind = NESTABLE_DISPLAY_KINDS.find((k) => k === kindName);
    if (!section || !kind) return;
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
  };

  const addSection = () => {
    const section = { id: newBlockId(), title: "Section title", blocks: [] };
    onChange([...sections, section]);
    selectChild(sectionChild(section, sections.length), { focus: true });
  };

  return (
    <>
      {sections.length > 0 && (
        <ChildRows>
          {sections.map((section, index) => (
            <ChildRow
              key={section.id ?? index}
              label={describeSection(section)}
              onSelect={() => selectChild(sectionChild(section, index))}
              {...neighborMoves(sections, index, onChange)}
              className="font-medium"
            >
              <div className="flex flex-col gap-2 pb-2 pl-6 pr-2">
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
                <Select
                  value=""
                  aria-label={`Add block to ${sectionTitle(section)}`}
                  onChange={(event) => addBlock(index, event.target.value)}
                  className="h-control-sm"
                >
                  <option value="" disabled>
                    Add block…
                  </option>
                  {NESTABLE_DISPLAY_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {DISPLAY_KIND_NAMES[kind]}
                    </option>
                  ))}
                </Select>
              </div>
            </ChildRow>
          ))}
        </ChildRows>
      )}
      <AddItemButton onClick={addSection}>Add section</AddItemButton>
    </>
  );
}
