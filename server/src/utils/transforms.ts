/**
 * `class-transformer` normalizers for text input, applied with `@Transform`.
 *
 * Non-string values pass through untouched so the validation decorators, not
 * the transform, decide what to reject.
 */

export const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Like {@link trim}, but collapses blank input to `null`. Prefer this for
 * nullable text columns so absence has a single representation.
 */
export const trimToNull = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() || null : value;

export const trimStringArray = ({ value }: { value: unknown }): unknown =>
  Array.isArray(value)
    ? value.map((item) => (typeof item === 'string' ? item.trim() : item))
    : value;
