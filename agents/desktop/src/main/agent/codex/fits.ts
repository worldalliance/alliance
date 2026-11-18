import type { z } from "zod";

/** True when the generated type T is assignable to schema S's input type, so a Codex version whose protocol changes a field the adapter reads fails the build. A T of never, such as an Extract of a variant Codex dropped, doesn't fit. Only assignability to that input type is checked, so neither refinements, nor a strict object's rejection of unknown keys, nor a schema whose input is unknown, such as z.preprocess, constrain T. */
export type Fits<S extends z.ZodType, T> = [T] extends [never]
  ? false
  : [T] extends [z.input<S>]
    ? true
    : false;
