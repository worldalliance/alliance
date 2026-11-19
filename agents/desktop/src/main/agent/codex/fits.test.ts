import { expectTypeOf, test } from "bun:test";
import type { z } from "zod";
import type { Fits } from "./fits";

type Schema = z.ZodObject<{
  a: z.ZodString;
  kind: z.ZodEnum<{ x: "x"; y: "y" }>;
}>;
type Parsed = z.ZodPipe<z.ZodString, z.ZodTransform<number, string>>;

test("Fits holds for a fitting type and fails each drift below, checked when typecheck compiles this file", () => {
  expectTypeOf<
    Fits<Schema, { a: string; kind: "x"; extra: number }>
  >().toEqualTypeOf<true>();
  expectTypeOf<Fits<Parsed, string>>().toEqualTypeOf<true>();
  expectTypeOf<
    Fits<Schema, { a: string | null; kind: "x" }>
  >().toEqualTypeOf<false>();
  expectTypeOf<
    Fits<Schema, { a?: string; kind: "x" }>
  >().toEqualTypeOf<false>();
  expectTypeOf<Fits<Schema, { kind: "x" }>>().toEqualTypeOf<false>();
  expectTypeOf<
    Fits<Schema, { a: string; kind: "x" | "z" }>
  >().toEqualTypeOf<false>();
  expectTypeOf<
    Fits<Schema, { a: string; kind: "x" } | { a: null; kind: "y" }>
  >().toEqualTypeOf<false>();
  expectTypeOf<Fits<Schema, never>>().toEqualTypeOf<false>();
});
