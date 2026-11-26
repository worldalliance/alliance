import { Fragment, type ReactNode } from "react";
import { MoreMenu, type MoreMenuItem } from "../../../../ui/MoreMenu";
import {
  Table,
  TableBody,
  TableCell,
  TableGroupRow,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../../ui/Table";
import { optionName } from "./OptionRows";
import { swapOptions } from "./optionRules";

type Option = { label: string; value: string };

export type OptionSectionRows = {
  /** The category's id, or "" for options without one. */
  id: string;
  /** Names the section's list: "Options in West". */
  label: string;
  /** Shown above the section when the options have categories. */
  heading: string | null;
  indices: number[];
};

/** Every fixed option on one line, for the larger editor's sheet. */
export function FixedOptionsTable<O extends Option>({
  options,
  sections,
  withCategory,
  onReorder,
  onRemove,
  cells,
}: {
  options: readonly O[];
  sections: readonly OptionSectionRows[];
  withCategory: boolean;
  onReorder: (options: O[]) => void;
  onRemove: (index: number) => void;
  cells: Record<
    "label" | "value" | "default" | "category",
    (index: number) => ReactNode
  >;
}) {
  const columns = withCategory ? 5 : 4;
  const menu = (indices: number[], position: number): MoreMenuItem[] => {
    const index = indices[position];
    const move = (label: string, step: number, edge: string): MoreMenuItem => {
      const other = indices[position + step];
      return other === undefined
        ? { label, onSelect: () => {}, disabledReason: edge }
        : {
            label,
            onSelect: () => onReorder(swapOptions(options, index, other)),
          };
    };
    return [
      move("Move up", -1, "It's the first."),
      move("Move down", 1, "It's the last."),
      {
        label: "Remove option",
        onSelect: () => onRemove(index),
        destructive: true,
      },
    ];
  };
  return (
    <Table aria-label="Options">
      <TableHeader>
        <TableRow>
          <TableHead>Label</TableHead>
          <TableHead>Value</TableHead>
          <TableHead>Default</TableHead>
          {withCategory && <TableHead>Category</TableHead>}
          <TableHead actions>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sections.map((section) => (
          <Fragment key={section.id}>
            {section.heading !== null && (
              <TableGroupRow
                colSpan={columns}
                label={section.heading}
                count={section.indices.length}
              />
            )}
            {section.indices.map((index, position) => (
              <TableRow key={index}>
                <TableCell className="min-w-56">{cells.label(index)}</TableCell>
                <TableCell className="w-40">
                  <div className="flex">{cells.value(index)}</div>
                </TableCell>
                <TableCell>{cells.default(index)}</TableCell>
                {withCategory && (
                  <TableCell className="min-w-44">
                    {cells.category(index)}
                  </TableCell>
                )}
                <TableCell actions>
                  <MoreMenu
                    items={menu(section.indices, position)}
                    subject={optionName(options[index], position)}
                    size="small"
                  />
                </TableCell>
              </TableRow>
            ))}
          </Fragment>
        ))}
      </TableBody>
    </Table>
  );
}
