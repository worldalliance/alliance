export type Success<T> = {
  ok: true;
  value: T;
};

export type Failure<E> = {
  ok: false;
  error: E;
};

export type Result<T, E = Error> = Success<T> | Failure<E>;

function success<T>(value: T): Success<T> {
  return { ok: true, value };
}

function failure<E>(error: E): Failure<E> {
  return { ok: false, error };
}

function isSuccess<T, E>(result: Result<T, E>): result is Success<T> {
  return result.ok;
}

function isFailure<T, E>(result: Result<T, E>): result is Failure<E> {
  return !result.ok;
}

function map<T, E, U>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  return result.ok ? success(fn(result.value)) : result;
}

function mapError<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F,
): Result<T, F> {
  return result.ok ? result : failure(fn(result.error));
}

function flatMap<T, E, U, F>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, F>,
): Result<U, E | F> {
  return result.ok ? fn(result.value) : result;
}

const andThen = flatMap;

function unwrap<T, E>(result: Result<T, E>): T {
  if (result.ok) return result.value;

  throw toError(result.error);
}

function expect<T, E>(result: Result<T, E>, message: string): T {
  if (result.ok) return result.value;

  throw new Error(message, { cause: result.error });
}

function unwrapOr<T, E>(result: Result<T, E>, fallback: T): T {
  return result.ok ? result.value : fallback;
}

function unwrapOrElse<T, E>(
  result: Result<T, E>,
  getFallback: (error: E) => T,
): T {
  return result.ok ? result.value : getFallback(result.error);
}

function match<T, E, U>(
  result: Result<T, E>,
  handlers: {
    success: (value: T) => U;
    failure: (error: E) => U;
  },
): U {
  return result.ok
    ? handlers.success(result.value)
    : handlers.failure(result.error);
}

function toError(error: unknown): Error {
  return error instanceof Error
    ? error
    : new Error(String(error), { cause: error });
}

function fromThrowable<T>(fn: () => T): Result<T, Error>;
function fromThrowable<T, E>(
  fn: () => T,
  mapThrown: (error: unknown) => E,
): Result<T, E>;
function fromThrowable<T, E>(
  fn: () => T,
  mapThrown?: (error: unknown) => E,
): Result<T, E | Error> {
  try {
    return success(fn());
  } catch (error) {
    return failure(mapThrown ? mapThrown(error) : toError(error));
  }
}

function fromPromise<T>(promise: Promise<T>): Promise<Result<T, Error>>;
function fromPromise<T, E>(
  promise: Promise<T>,
  mapRejected: (error: unknown) => E,
): Promise<Result<T, E>>;
async function fromPromise<T, E>(
  promise: Promise<T>,
  mapRejected?: (error: unknown) => E,
): Promise<Result<T, E | Error>> {
  try {
    return success(await promise);
  } catch (error) {
    return failure(mapRejected ? mapRejected(error) : toError(error));
  }
}

function fromPromiseFn<T>(fn: () => Promise<T>): Promise<Result<T, Error>>;
function fromPromiseFn<T, E>(
  fn: () => Promise<T>,
  mapRejected: (error: unknown) => E,
): Promise<Result<T, E>>;
async function fromPromiseFn<T, E>(
  fn: () => Promise<T>,
  mapRejected?: (error: unknown) => E,
): Promise<Result<T, E | Error>> {
  try {
    return success(await fn());
  } catch (error) {
    return failure(mapRejected ? mapRejected(error) : toError(error));
  }
}

function fromNullable<T, E>(
  value: T | null | undefined,
  error: E,
): Result<T, E> {
  return value == null ? failure(error) : success(value);
}

function toNullable<T, E>(result: Result<T, E>): T | null {
  return result.ok ? result.value : null;
}

function toUndefined<T, E>(result: Result<T, E>): T | undefined {
  return result.ok ? result.value : undefined;
}

/**
 * `Result<T, E>` is the type; `R` is the helper namespace. Import the value
 * (`R`) and the type (`Result`) separately:
 *
 * ```ts
 * import { R, type Result } from "@alliance/common/result";
 *
 * function parse(input: string): Result<number, string> {
 *   const n = Number(input);
 *   return Number.isNaN(n) ? R.failure("not a number") : R.success(n);
 * }
 *
 * const result = parse("42");
 * const doubled = R.map(result, (n) => n * 2);
 * const value = R.unwrapOr(doubled, 0);
 * ```
 */
export const R = {
  success,
  failure,
  isSuccess,
  isFailure,
  map,
  mapError,
  flatMap,
  andThen,
  unwrap,
  expect,
  unwrapOr,
  unwrapOrElse,
  match,
  toError,
  fromThrowable,
  fromPromise,
  fromPromiseFn,
  fromNullable,
  toNullable,
  toUndefined,
} as const;
