/**
 * Result Type Pattern for Safe Error Handling
 */

export type Result<T, E> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: E };

export function ok<T, E = never>(data: T): Result<T, E> {
  return { ok: true, data };
}

export function err<E, T = never>(error: E): Result<T, E> {
  return { ok: false, error };
}
