import type { Page, PageItem } from "@alliance/common/forms/form-schema";
import { Copy } from "lucide-react";
import { useId, useState } from "react";
import { describeElement } from "../../../../components/form-canvas/canvasSelection";
import {
  InsertMode,
  type AvailableElement,
} from "../../../../components/form-canvas/InsertPoint";
import Button, { ButtonVariant } from "../../../../ui/Button";
import { CommandList, type CommandGroup } from "../../../../ui/CommandList";
import { Select } from "../../../../ui/Select";
import { kindIcon } from "../outline/elementIcons";

/** "Text Area Field" → "Text area": the group says whether it is a question or content. */
export const pickerLabel = (name: string) =>
  name
    .replace(/ (Field|Block)$/, "")
    .split(" ")
    .map((word, at) =>
      at === 0 || word === word.toUpperCase() ? word : word.toLowerCase(),
    )
    .join(" ");

const idOf = (element: AvailableElement) => `${element.type}:${element.id}`;

const iconOf = (element: AvailableElement) => {
  switch (element.type) {
    case "field":
      return kindIcon({ kind: element.id, question: true });
    case "block":
      return kindIcon({ kind: element.kind, question: false });
    case "copy":
      return Copy;
    default:
      throw new Error(`unknown element: ${element satisfies never}`);
  }
};

/**
 * What the add picker lists: today's question kinds and blocks, searchable,
 * then copying an element already on the form, which turns the picker into a
 * choice of that element.
 */
export function InsertPicker({
  mode,
  elements,
  onPick,
  pages,
  onCopy,
  onCancel,
}: {
  mode: InsertMode;
  elements: AvailableElement[];
  onPick: (element: AvailableElement) => void;
  pages: Page[];
  onCopy: (source: PageItem) => void;
  onCancel: () => void;
}) {
  switch (mode) {
    case InsertMode.Search: {
      const group = (label: string, type: AvailableElement["type"]) => ({
        label,
        items: elements
          .filter((element) => element.type === type)
          .map((element) => ({
            id: idOf(element),
            label:
              element.type === "copy"
                ? element.name
                : pickerLabel(element.name),
            icon: iconOf(element),
          })),
      });
      const groups: CommandGroup[] = [
        group("Questions", "field"),
        group("Content", "block"),
        group("Copy", "copy"),
      ].filter((entry) => entry.items.length > 0);
      return (
        <CommandList
          label="Search elements"
          placeholder="Questions and content"
          groups={groups}
          onPick={(id) => {
            const element = elements.find((entry) => idOf(entry) === id);
            if (element) onPick(element);
          }}
        />
      );
    }
    case InsertMode.Copy:
      return (
        <CopyElementPicker pages={pages} onCopy={onCopy} onCancel={onCancel} />
      );
    default:
      throw new Error(`unknown mode: ${mode satisfies never}`);
  }
}

// Kept as UI state rather than a schema element, so an in-progress pick
// never gets saved.
function CopyElementPicker({
  pages,
  onCopy,
  onCancel,
}: {
  pages: Page[];
  onCopy: (source: PageItem) => void;
  onCancel: () => void;
}) {
  const id = useId();
  const [value, setValue] = useState("");
  const hasElements = pages.some((page) => page.fields.length > 0);
  const commit = () => {
    const [pageIndex, elementIndex] = value.split(":").map(Number);
    const source =
      pageIndex === undefined || elementIndex === undefined
        ? undefined
        : pages[pageIndex]?.fields[elementIndex];
    if (source) onCopy(source);
  };
  return (
    <div className="flex w-80 flex-col gap-3 p-3">
      <label htmlFor={id} className="text-caption font-medium">
        Element to copy
      </label>
      <Select
        id={id}
        autoFocus
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && value) {
            event.preventDefault();
            commit();
          }
        }}
      >
        <option value="" disabled>
          {hasElements
            ? "Choose an element to copy…"
            : "No elements to copy yet"}
        </option>
        {pages.map(
          (page, pageIndex) =>
            page.fields.length > 0 && (
              <optgroup
                key={page.id}
                label={page.title || `Page ${pageIndex + 1}`}
              >
                {page.fields.map((element, elementIndex) => (
                  <option
                    key={element.id || `${pageIndex}:${elementIndex}`}
                    value={`${pageIndex}:${elementIndex}`}
                  >
                    {describeElement(element)}
                  </option>
                ))}
              </optgroup>
            ),
        )}
      </Select>
      <div className="flex justify-end gap-2">
        <Button variant={ButtonVariant.Ghost} size="small" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant={ButtonVariant.Primary}
          size="small"
          disabled={!value}
          onClick={commit}
        >
          Insert
        </Button>
      </div>
    </div>
  );
}
