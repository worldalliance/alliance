import type { FormSchema } from "@alliance/common/forms/form-schema";
import { useCallback, useState } from "react";
import {
  deriveVisibilityGroups,
  normalizeVisibilityGroups,
  type VisibilityGroups,
} from "./visibilityGroups";

type State = { schema: FormSchema; groups: VisibilityGroups };

/**
 * The builder's schema with its visibility groups, updated together so a
 * schema edit never renders against groups it has invalidated.
 */
export function useVisibilityGroupedSchema(initialSchema: () => FormSchema) {
  const [state, setState] = useState<State>(() => {
    const schema = initialSchema();
    return { schema, groups: deriveVisibilityGroups(schema.pages) };
  });

  /** Keeps the current groups, or `groups`, wherever `schema` still allows. */
  const setSchema = useCallback(
    (schema: FormSchema, groups?: VisibilityGroups) =>
      setState((prev) => ({
        schema,
        groups: normalizeVisibilityGroups(schema.pages, groups ?? prev.groups),
      })),
    [],
  );

  /** Replaces the schema wholesale, regrouping it from its conditions. */
  const loadSchema = useCallback(
    (schema: FormSchema) =>
      setState({ schema, groups: deriveVisibilityGroups(schema.pages) }),
    [],
  );

  const setGroups = useCallback(
    (groups: VisibilityGroups) =>
      setState((prev) => ({
        ...prev,
        groups: normalizeVisibilityGroups(prev.schema.pages, groups),
      })),
    [],
  );

  return {
    schema: state.schema,
    groups: state.groups,
    setSchema,
    loadSchema,
    setGroups,
  };
}
