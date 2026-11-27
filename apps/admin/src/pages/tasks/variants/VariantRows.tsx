import type { ActionFormVariantDto } from "@alliance/shared/client/types.gen";
import Badge, { BadgeTone } from "../../../ui/Badge";
import Button, { ButtonVariant } from "../../../ui/Button";
import { Input } from "../../../ui/Input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../ui/Table";
import {
  formHref,
  isDirty,
  type StagedVariant,
  type VariantEdit,
} from "./variantRules";

const splitFromInput = (value: string) => Number(value);

export type VariantRowsProps = {
  staged: StagedVariant[];
  variants: ActionFormVariantDto[];
  editOf: (variant: ActionFormVariantDto) => VariantEdit;
  /** Publishing is under way: drafts can't change or go. */
  publishing: boolean;
  savingIds: ReadonlySet<number>;
  deletingIds: ReadonlySet<number>;
  onEditStaged: (tempId: string, patch: Partial<VariantEdit>) => void;
  onRemoveStaged: (tempId: string) => void;
  onEdit: (variant: ActionFormVariantDto, patch: Partial<VariantEdit>) => void;
  onSave: (variant: ActionFormVariantDto) => void;
  onDelete: (variant: ActionFormVariantDto) => void;
};

const SPLIT_INPUT_CLASS = "w-24 text-right tabular-nums";

/** Drafts first, then the published variants; both edit their name and split in place. */
export function VariantRows(props: VariantRowsProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead className="text-right">Split (% of new joiners)</TableHead>
          <TableHead>Status</TableHead>
          <TableHead actions>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {props.staged.map((draft) => (
          <TableRow key={draft.tempId}>
            <TableCell>
              <Input
                aria-label={`Name of staged variant ${draft.name}`}
                value={draft.name}
                onChange={(e) =>
                  props.onEditStaged(draft.tempId, { name: e.target.value })
                }
              />
            </TableCell>
            <TableCell className="text-right">
              <Input
                type="number"
                min={0}
                max={100}
                step="any"
                aria-label={`Split of staged variant ${draft.name}`}
                className={SPLIT_INPUT_CLASS}
                value={draft.splitValue}
                onChange={(e) =>
                  props.onEditStaged(draft.tempId, {
                    splitValue: splitFromInput(e.target.value),
                  })
                }
              />
            </TableCell>
            <TableCell>
              <Badge tone={BadgeTone.Warning}>Staged</Badge>
            </TableCell>
            <TableCell actions>
              <Button
                size="small"
                variant={ButtonVariant.Default}
                aria-label={`Remove staged variant ${draft.name}`}
                disabled={props.publishing}
                onClick={() => props.onRemoveStaged(draft.tempId)}
              >
                Remove
              </Button>
            </TableCell>
          </TableRow>
        ))}
        {props.variants.map((variant) => {
          const edit = props.editOf(variant);
          return (
            <TableRow key={variant.id}>
              <TableCell>
                <Input
                  aria-label={`Name of variant ${variant.name}`}
                  value={edit.name}
                  onChange={(e) =>
                    props.onEdit(variant, { name: e.target.value })
                  }
                />
              </TableCell>
              <TableCell className="text-right">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="any"
                  aria-label={`Split of variant ${variant.name}`}
                  className={SPLIT_INPUT_CLASS}
                  value={edit.splitValue}
                  onChange={(e) =>
                    props.onEdit(variant, {
                      splitValue: splitFromInput(e.target.value),
                    })
                  }
                />
              </TableCell>
              <TableCell>
                <Badge tone={BadgeTone.Success}>Published</Badge>
              </TableCell>
              <TableCell actions>
                <div className="flex justify-end gap-2">
                  <Button
                    size="small"
                    variant={ButtonVariant.Default}
                    aria-label={`Edit form: ${variant.name}`}
                    to={formHref(variant.formId)}
                  >
                    Edit form
                  </Button>
                  <Button
                    size="small"
                    variant={ButtonVariant.Primary}
                    aria-label={`Save: ${variant.name}`}
                    busy={props.savingIds.has(variant.id)}
                    disabled={!isDirty(variant, edit)}
                    onClick={() => props.onSave(variant)}
                  >
                    Save
                  </Button>
                  <Button
                    size="small"
                    variant={ButtonVariant.DangerOutline}
                    aria-label={`Delete: ${variant.name}`}
                    busy={props.deletingIds.has(variant.id)}
                    onClick={() => props.onDelete(variant)}
                  >
                    Delete
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
