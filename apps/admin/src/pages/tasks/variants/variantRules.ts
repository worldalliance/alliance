import type {
  ActionFormVariantDto,
  ActionFormVariantsListDto,
} from "@alliance/shared/client/types.gen";
import { href } from "react-router";
import { makeTempId } from "../../../lib/tempId";

export type VariantEdit = { name: string; splitValue: number };

export type StagedVariant = VariantEdit & { tempId: string };

/** The server stores a split as a fraction; staff edit it as a percentage. */
export const asPercentages = (list: ActionFormVariantsListDto) => ({
  variants: list.variants.map((v) => ({
    ...v,
    splitValue: v.splitValue * 100,
  })),
  stats: list.stats.map((s) => ({
    ...s,
    splitValue: s.splitValue == null ? null : s.splitValue * 100,
  })),
});

export const formHref = (formId: number) =>
  href("/tasks/forms/:formId", { formId: formId.toString() });

/** The saved splits and the staged ones, which the server's 100% limit counts once published. */
export const splitTotal = (params: {
  variants: readonly { splitValue: number }[];
  staged: readonly { splitValue: number }[];
}) =>
  [...params.variants, ...params.staged].reduce(
    (sum, v) => sum + v.splitValue,
    0,
  );

/** The next draft: lettered after every variant so far, taking up to half of what is left. */
export const nextDraft = (params: {
  variants: readonly { splitValue: number }[];
  staged: readonly { splitValue: number }[];
}): StagedVariant => {
  const remaining = Math.max(0, 100 - splitTotal(params));
  return {
    tempId: makeTempId(),
    name: `Variant ${String.fromCharCode(
      65 + params.variants.length + params.staged.length,
    )}`,
    splitValue: Math.min(remaining, 50),
  };
};

export const isDirty = (
  variant: Pick<ActionFormVariantDto, "name" | "splitValue">,
  edit: VariantEdit,
) => edit.name !== variant.name || edit.splitValue !== variant.splitValue;

/**
 * What a delete does, as `ActionFormVariantService.deleteVariant` decides
 * (`server/src/actions/action-form-variant.service.ts:212-264`).
 */
export const DELETE_VARIANT_MESSAGE = [
  "Until the task's Members taking action event takes effect, and while this variant's form has no responses, deleting it also removes every member's assignment to it. Those members are assigned again the next time they load the task.",
  "After that, the server refuses to delete it while any member is assigned.",
  "The variant's form stays in Forms.",
].join("\n");
