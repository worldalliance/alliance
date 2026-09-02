import type { DisplayBlock } from "@alliance/common/forms/display-blocks";
import type { FormSchema } from "@alliance/common/forms/form-schema";
import { useCallback, useLayoutEffect, useRef } from "react";
import {
  findDisplayBlock,
  replaceDisplayBlock,
  type BlockWriteById,
} from "./displayBlockById";

/**
 * A write addressed by block id against the form as it stands, for a handler
 * that outlives the render it was made in. False once the form no longer holds
 * the block.
 */
export function useDisplayBlockWrite(
  schema: FormSchema,
  onSchemaChange: (schema: FormSchema) => void,
): BlockWriteById {
  // A passive effect would leave this a render behind between commit and
  // flush, which is long enough for an upload to land on the form it replaces.
  const latest = useRef({ schema, onSchemaChange });
  useLayoutEffect(() => {
    latest.current = { schema, onSchemaChange };
  });

  return useCallback<BlockWriteById>((blockId, update) => {
    const { schema: form, onSchemaChange: write } = latest.current;
    const block = findDisplayBlock(form, blockId);
    if (!block) return false;
    // Spreading a partial over a union member widens past the union, and
    // `update` only answers with fields of the block it was handed.
    const next = { ...block, ...update(block) } as DisplayBlock;
    const nextForm = replaceDisplayBlock({ schema: form, target: block, next });
    // Two writes in one batch commit together, so the second would read the
    // form the first replaces. The effect above puts the real one back.
    latest.current = { ...latest.current, schema: nextForm };
    write(nextForm);
    return true;
  }, []);
}
